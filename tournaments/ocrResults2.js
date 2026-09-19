const fetch = require('node-fetch');
const isAdminChat = require('../admin/permissionAdminChat');

const OCR_API_KEY = process.env.OCR_SPACE_API_KEY;

/* ============================================================
   OCR.SPACE — вызов с overlay
============================================================ */
async function callOcrSpaceByUrl(imageUrl) {
  const params = new URLSearchParams();
  params.append('apikey', OCR_API_KEY);
  params.append('url', imageUrl);

  // Язык интерфейса и ников
  params.append('language', 'eng+rus'); // можно добавить +chi_sim при желании

  params.append('isTable', 'true');
  params.append('OCREngine', '2');
  params.append('filetype', 'JPG');       // фикс ошибки E216
  params.append('isOverlayRequired', 'true'); // ВКЛЮЧАЕМ КООРДИНАТЫ

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    throw new Error('HTTP error from OCR: ' + res.status + ' ' + res.statusText);
  }

  const data = await res.json();
  // console.log('OCR RAW =', JSON.stringify(data, null, 2));

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
  if (!first || !first.TextOverlay) {
    throw new Error('TextOverlay missing in OCR response');
  }

  return {
    text: first.ParsedText || '',
    overlay: first.TextOverlay,
  };
}

/* ============================================================
   Утилита: нормализация килов (0 / O / О)
============================================================ */
function normalizeKills(str) {
  if (!str) return NaN;
  const normalized = str.replace(/[OoОо]/g, '0');
  const num = parseInt(normalized, 10);
  return Number.isNaN(num) ? NaN : num;
}

/* ============================================================
   Разбор overlay одной страницы в команды
   ЛОГИКА:
   - overlay.Lines -> каждая "строка" с набором слов
   - слева (маленький X, чистое число) — номера мест (rank)
   - по вертикали между rank_i и rank_{i+1} — "полоса" одной команды
   - внутри полосы:
       * строки делим по словам:
         - до первой цифры → ник
         - слово с цифрой → килы
         - остальное игнорим
   - команда получает массив players[], размер может быть 2,3,4...
============================================================ */
function buildTeamsFromOverlay(overlay) {
  if (!overlay || !Array.isArray(overlay.Lines)) return [];

  // Нормализуем строки
  const lines = overlay.Lines.map(line => {
    const words = line.Words || [];
    const text = words.map(w => w.WordText).join(' ').trim();

    const xs = words.map(w => w.Left);
    const ys = words.map(w => w.Top);
    const xe = words.map(w => w.Left + w.Width);
    const ye = words.map(w => w.Top + w.Height);

    const left = Math.min(...xs);
    const right = Math.max(...xe);
    const top = Math.min(...ys);
    const bottom = Math.max(...ye);
    const cy = (top + bottom) / 2;

    return { text, words, left, right, top, bottom, cy };
  });

  if (!lines.length) return [];

  const minLeft = Math.min(...lines.map(l => l.left));
  const maxLeft = Math.max(...lines.map(l => l.left));
  const screenWidth = maxLeft - minLeft || 1;

  // Линии с номерами мест (1,2,3...), расположенные слева
  const rankLines = lines
    .filter(
      l =>
        /^\d+$/.test(l.text.trim()) &&
        l.left < minLeft + screenWidth * 0.35
    )
    .sort((a, b) => a.cy - b.cy);

  // Если не нашли явные ранги — просто вернём одну "команду" со всеми игроками
  if (!rankLines.length) {
    const players = parsePlayerRowsInTeam(lines);
    return [
      {
        rank: 1,
        players,
        totalKills: players.reduce((s, p) => s + (p.kills || 0), 0),
      },
    ];
  }

  const teams = [];

  for (let i = 0; i < rankLines.length; i++) {
    const r = rankLines[i];
    const next = rankLines[i + 1];

    const yMin = r.top - 5;
    const yMax = next ? next.top - 5 : Infinity;

    // Все строки между текущим рангом и следующим
    const slice = lines.filter(
      l => l.cy >= yMin && l.cy < yMax && l !== r && !/^\d+$/.test(l.text.trim())
    );

    const players = parsePlayerRowsInTeam(slice);

    teams.push({
      rank: parseInt(r.text.trim(), 10) || i + 1,
      players,
      totalKills: players.reduce((s, p) => s + (p.kills || 0), 0),
    });
  }

  return teams;
}

/* ============================================================
   Разбор строк одной команды в игроков
   Попытка №1: каждая строка = "ник ... число уничтожений"
   Попытка №2: если не получилось — ищем ближайшую строку с килами
============================================================ */
function parsePlayerRowsInTeam(lines) {
  if (!lines.length) return [];

  const players = [];

  // Сначала пробуем разобрать по строкам вида:
  // [words: NAME ... NAME] [word: NUM] [word: уничтожений]
  for (const line of lines) {
    const { words } = line;
    if (!words || !words.length) continue;

    let nameTokens = [];
    let killsToken = null;

    for (const w of words) {
      const t = (w.WordText || '').trim();
      if (!t) continue;

      // если слово содержит цифру — считаем, что это часть "киллов"
      if (/\d/.test(t)) {
        killsToken = killsToken || t;
      } else if (!killsToken) {
        // ещё до чисел — это ник
        nameTokens.push(t);
      }
    }

    const name = nameTokens.join(' ').trim();
    const kills = normalizeKills(killsToken);

    if (name && !Number.isNaN(kills)) {
      players.push({ name, kills });
    }
  }

  if (players.length) {
    // Уже нашли игроков, возвращаем
    return players;
  }

  // Fallback: старый способ — разделяем строки на ники и кило-строки,
  // соединяем по ближайшему cy.
  const nameLines = [];
  const killLines = [];

  for (const l of lines) {
    if (/(уничтож|elim)/i.test(l.text)) killLines.push(l);
    else nameLines.push(l);
  }

  const fallbackPlayers = nameLines.map(nl => {
    let best = null;
    let bestDy = Infinity;

    for (const kl of killLines) {
      const dy = Math.abs(kl.cy - nl.cy);
      if (dy < bestDy) {
        bestDy = dy;
        best = kl;
      }
    }

    let kills = 0;
    if (best) {
      const m = best.text.match(/([0-9OoОо]+)/);
      if (m) {
        kills = normalizeKills(m[1]);
      }
    }

    return {
      name: nl.text.trim(),
      kills: Number.isNaN(kills) ? 0 : kills,
    };
  });

  return fallbackPlayers;
}

/* ============================================================
   Форматирование (авто-определение: дуо/сквады)
============================================================ */
function formatTeamsForMessage(teams) {
  if (!teams.length) return '❌ Нет распознанных команд.';

  // Определим "режим" для красоты заголовка
  const sizes = teams.map(t => t.players.length).filter(n => n > 0);
  const avgSize = sizes.length
    ? sizes.reduce((a, b) => a + b, 0) / sizes.length
    : 0;

  let mode = 'Команды';
  if (avgSize <= 2.5) mode = 'DUO';
  else if (avgSize <= 3.5) mode = 'TRIO';
  else mode = 'SQUAD';

  const out = [`🏆 Результаты (${mode}):`, ''];

  // Ранги берём по порядку, как шли
  let globalRank = 1;
  for (const t of teams) {
    const names = t.players.map(p => p.name).join(' + ');
    out.push(
      `${globalRank}) ${names} — ${t.totalKills} киллов`
    );
    globalRank++;
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
    if (!isAdmin) return;

    const groupId = msg.media_group_id;

    /* ---------- Одиночное фото ---------- */
    if (!groupId) {
      const caption = (msg.caption || '').trim();
      if (!/^!результаты/i.test(caption)) return;

      const fileId = msg.photo[msg.photo.length - 1].file_id;

      return processImagesArray(
        bot,
        chatId,
        [{ fileId, messageId: msg.message_id }],
        msg.message_id
      );
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

      await processImagesArray(
        bot,
        group.chatId,
        group.photos,
        group.firstMessageId
      );
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

  const allTeams = [];

  for (const item of sorted) {
    const fileLink = await bot.getFileLink(item.fileId);
    const { overlay } = await callOcrSpaceByUrl(fileLink);
    const pageTeams = buildTeamsFromOverlay(overlay);
    allTeams.push(...pageTeams);
  }

  if (!allTeams.length) {
    return bot.sendMessage(
      chatId,
      '❌ Не распарсились команды. Попробуй другой скрин (чётче / без обрезки).',
      { reply_to_message_id: replyToMessageId }
    );
  }

  const msg = formatTeamsForMessage(allTeams);
  return bot.sendMessage(chatId, msg, {
    reply_to_message_id: replyToMessageId,
  });
}
