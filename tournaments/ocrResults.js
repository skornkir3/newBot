const fetch = require('node-fetch');
const isAdminChat = require('../admin/permissionAdminChat');

const OCR_API_KEY = process.env.OCR_SPACE_API_KEY;

/* ============================================================
   OCR.SPACE — вызов
============================================================ */
async function callOcrSpaceByUrl(imageUrl) {
  const params = new URLSearchParams();
  params.append('apikey', OCR_API_KEY);
  params.append('url', imageUrl);

  // Поддержка RU + EN + JP + Chinese
  params.append('language', 'eng');

  params.append('isTable', 'true');
  params.append('OCREngine', '2');
  params.append('filetype', 'JPG'); // фикс ошибки E216

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    throw new Error('HTTP error from OCR: ' + res.status + ' ' + res.statusText);
  }

  const data = await res.json();
//  console.log('OCR RAW =', JSON.stringify(data, null, 2));

  if (data.IsErroredOnProcessing) {
    const msg =
      (Array.isArray(data.ErrorMessage)
        ? data.ErrorMessage.join('; ')
        : data.ErrorMessage || '') ||
      data.ErrorDetails ||
      'Unknown OCR error';
    throw new Error('OCR.space error: ' + msg);
  }

  if (!data.ParsedResults || !data.ParsedResults.length) {
    throw new Error('No ParsedResults in OCR response');
  }

  const first = data.ParsedResults[0];
  if (!first || typeof first.ParsedText !== 'string') {
    throw new Error('ParsedResults[0].ParsedText is missing');
  }

  return first.ParsedText;
}

/* ============================================================
   ПАРСЕР — поддерживает:
   • Ник + 5 уничтожений           (в 1 строке)
   • Ник                  (строка 1)
     5 уничтожений        (строка 2)
   • 7 CM Gnida           (ник с номером)
   • Любые японские / китайские ники
============================================================ */
function parsePubgDuoPage(rawText) {
  if (typeof rawText !== 'string') return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(l => (l || '').trim())
    .filter(l => l.length > 0);

  const players = [];
  let pendingName = null; // имя, которое ждёт килы

  // ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ КИЛОВ =====
  const parseKills = (str) => {
    if (!str) return NaN;
    // Иногда OCR пишет O / o (латиница) или О / о (кириллица) вместо "0"
    const normalized = str.replace(/[OoОо]/g, '0');
    const num = parseInt(normalized, 10);
    return Number.isNaN(num) ? NaN : num;
  };

  for (const line of lines) {
    if (!line) continue;

    // 1) Чистое число (место) — пропускаем
    if (/^\d+$/.test(line)) continue;

    // 2) "nick 5 уничтожений"
    //    учитываем 0-9, латинскую O/o и кириллическую О/о
    const fullLineMatch = line.match(
      /^(.*?)\s+([0-9OoОо]+)\s*(?:уничтож[а-я]*|elim[^\s]*)\s*$/i
    );
    if (fullLineMatch) {
      const nameRaw = fullLineMatch[1].trim();
      const kills = parseKills(fullLineMatch[2]);
      if (nameRaw && !Number.isNaN(kills)) {
        players.push({ name: nameRaw, kills });
        pendingName = null;
        continue;
      }
    }

    // 3) только килы — "5 уничтожений" / "O уничтожений" и т.п.
    const killsOnlyMatch = line.match(
      /^([0-9OoОо]+)\s*(?:уничтож[а-я]*|elim[^\s]*)\s*$/i
    );
    if (killsOnlyMatch && pendingName) {
      const kills = parseKills(killsOnlyMatch[1]);
      if (!Number.isNaN(kills)) {
        players.push({ name: pendingName, kills });
        pendingName = null;
        continue;
      }
    }

    // 4) "7 CM Gnida" или "6 jesy2018" — номер + ник (любой пробельный символ)
    const placeNameMatch = line.match(/^\d+\s*(.+)$/);
    if (placeNameMatch) {
      pendingName = placeNameMatch[1].trim();
      continue;
    }

    // 5) строка без цифр — это ник (может быть второй строкой ника)
    if (!/\d/.test(line)) {
      pendingName = pendingName ? `${pendingName} ${line}` : line;
      continue;
    }

    // Остальное игнорируем как мусор
  }

  // ===== DUO: собираем по 2 игрока через буфер =====
  const teams = [];
  let buffer = [];

  for (const p of players) {
    buffer.push(p);

    if (buffer.length === 2) {
      const [p1, p2] = buffer;
      teams.push({
        players: [p1, p2],
        totalKills: p1.kills + p2.kills,
      });
      buffer = [];
    }
  }

  // если вдруг остался один "лишний" игрок — сделаем соло-команду
  if (buffer.length === 1) {
    const p1 = buffer[0];
    teams.push({
      players: [p1],
      totalKills: p1.kills,
    });
  }

  return teams;
}



/* ============================================================
   ОБРАБОТКА НЕСКОЛЬКИХ СТРАНИЦ
============================================================ */
function parseManyPages(pagesText) {
  const allTeams = [];
  let rank = 1;

  for (const text of pagesText) {
    const pageTeams = parsePubgDuoPage(text);
    for (const t of pageTeams) {
      allTeams.push({
        rank,
        players: t.players,
        totalKills: t.totalKills,
      });
      rank++;
    }
  }
  return allTeams;
}

/* ============================================================
   ФОРМАТИРОВАНИЕ
============================================================ */
function formatTeamsForMessage(teams) {
  if (!teams.length) return '❌ Нет распознанных команд.';

  const out = ['🏆 Результаты (DUO):', ''];
  for (const t of teams) {
    const names = t.players.map(p => p.name).join(' + ');
    out.push(`${t.rank}) ${names} — ${t.totalKills} киллов`);
  }
  return out.join('\n');
}

/* ============================================================
   ОБРАБОТКА ФОТО И АЛЬБОМОВ (media_group)
============================================================ */

const mediaGroups = new Map();

module.exports = function registerOcrResultsHandler(bot) {
  bot.on('photo', async msg => {
    const chatId = msg.chat.id;
    const isAdmin = await isAdminChat(chatId);
    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    if (!isAdmin) return;

    const groupId = msg.media_group_id;

    /* ---------- Одиночное фото ---------- */
    if (!groupId) {
      const caption = (msg.caption || '').trim();
      if (!/^!результаты/i.test(caption)) return;

      const fileId = msg.photo[msg.photo.length - 1].file_id;

      return processImagesArray(bot, chatId, [{ fileId, messageId: msg.message_id }], msg.message_id);
    }

    /* --------- Media Group (альбом) -------- */
    let group = mediaGroups.get(groupId);
    if (!group) {
      group = {
        chatId,
        photos: [],
        caption: '',
        firstMessageId: msg.message_id,
        timeout: null,
      };
      mediaGroups.set(groupId, group);
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    group.photos.push({ fileId, messageId: msg.message_id });

    if (msg.caption) {
      group.caption = msg.caption.trim();
      group.firstMessageId = msg.message_id;
    }

    if (group.timeout) clearTimeout(group.timeout);

    group.timeout = setTimeout(async () => {
      mediaGroups.delete(groupId);
      if (!/^!результаты/i.test(group.caption)) return;

      await processImagesArray(bot, group.chatId, group.photos, group.firstMessageId);
    }, 800);
  });
};

/* ============================================================
   ОБРАБОТКА МАССИВА КАРТИНОК
============================================================ */
async function processImagesArray(bot, chatId, items, replyToMessageId) {
  if (!OCR_API_KEY) {
    return bot.sendMessage(chatId, '❌ Нет OCR API KEY', {
      reply_to_message_id: replyToMessageId,
    });
  }

  await bot.sendMessage(
    chatId,
    `⏳ Обрабатываю ${items.length} скрин(ов)...`,
    { reply_to_message_id: replyToMessageId }
  );

  // сортируем по порядку сообщений (1-я страница → 2-я → 3-я)
  const sorted = [...items].sort((a, b) => a.messageId - b.messageId);

  const pagesText = [];

  for (const item of sorted) {
    const fileLink = await bot.getFileLink(item.fileId);
    const text = await callOcrSpaceByUrl(fileLink);
    pagesText.push(text);
    /*bot.sendMessage(chatId, text, {
      reply_to_message_id: replyToMessageId,
    }); */
  }

  const teams = parseManyPages(pagesText);

  if (!teams.length) {
    const raw = pagesText.join('\n\n================\n\n');
    return bot.sendMessage(
      chatId,
      '❌ Не распарсились команды.\nRAW:\n' + raw.slice(0, 3500),
      { reply_to_message_id: replyToMessageId }
    );
  }

  const msg = formatTeamsForMessage(teams);
  return bot.sendMessage(chatId, msg, {
    reply_to_message_id: replyToMessageId,
  });
}
