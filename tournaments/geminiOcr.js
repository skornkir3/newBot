const fetch = require('node-fetch');
const isAdminChat = require('../admin/permissionAdminChat');
const extractTeamsFromImageUrl = require('./geminiExtractTeams'); // новый модуль
const saveMapResultToDb = require('./saveMapResultDB');
const getClanId = require('../clan/getClanId');

// максимум 5 картинок из альбома
const MAX_IMAGES = 9;

// для хранения media_group
const mediaGroups = new Map();

/* ===================== ПОДСЧЁТ ОЧКОВ ===================== */

function getPlacementPts(place) {
  switch (place) {
    case 1:
      return 10;
    case 2:
      return 6;
    case 3:
      return 5;
    case 4:
      return 4;
    case 5:
      return 3;
    case 6:
      return 2;
    case 7:
      return 1;
    default:
      return 0;
  }
}

/**
 * На вход: массив команд со всех страниц:
 * [
 *   { place: 1, players: [...], totalKills: 10 },
 *   { place: 2, players: [...], totalKills: 6 },
 *   ...
 * ]
 * На выход: отсортированный массив с добавленными полями:
 * killsPts, placementPts, totalPts
 */
function calcAndSortTeams(allTeams) {
  const withPts = allTeams.map((t) => {
    const killsPts = t.totalKills || 0;
    const placementPts = t.place != null ? getPlacementPts(t.place) : 0;
    const totalPts = killsPts + placementPts;

    return {
      place: t.place,
      players: t.players,
      totalKills: t.totalKills,
      killsPts,
      placementPts,
      totalPts,
    };
  });

  // Сортировка по ПТС (desc), потом по киллам (desc), потом по месту (asc)
  withPts.sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;

    // место меньше — лучше
    const aPlace = a.place == null ? Infinity : a.place;
    const bPlace = b.place == null ? Infinity : b.place;
    return aPlace - bPlace;
  });

  return withPts;
}

/* ===================== ОСНОВНОЙ ХЕНДЛЕР ===================== */

module.exports = function registerOcrResultsHandler(bot) {
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;
    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}

    const groupId = msg.media_group_id;
    const caption = (msg.caption || '').trim();

    // Триггерим ЛЮБОЙ кейс только если есть команда !результа3
    // const isTrigger = /^!результаты3/i.test(caption);

    // ищем команду !результатыN
    const match = caption.match(/^!результаты(\d+)(?:\s|$)/i);
    console.log(match);
 

    const isTrigger = !!match;
    const mapNo = match ? parseInt(match[1], 10) : null;
    console.log(mapNo);
 //   return;
    /* ---------- Одиночное фото ---------- */
    if (!groupId) {
      if (!isTrigger) return;

      const fileId = msg.photo[msg.photo.length - 1].file_id;
      return processImagesArray(
        bot,
        chatId,
        [{ fileId, messageId: msg.message_id }],
        msg.message_id,
        mapNo
      );
    }

    /* ---------- Media Group (альбом) ---------- */
    let group = mediaGroups.get(groupId);
    if (!group) {
      group = {
        chatId,
        photos: [],
        caption: '',
        mapNo: null,        // сохраняем номер карты
        hasTrigger: false,  // нашли ли !результаты
        firstMessageId: msg.message_id,
        timeout: null,
      };
      mediaGroups.set(groupId, group);
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    group.photos.push({ fileId, messageId: msg.message_id });

    if (caption) {
      group.caption = caption;
      group.firstMessageId = msg.message_id;

      const match = caption.match(/^!результаты(\d+)(?:\s|$)/i);
      if (match) {
        group.mapNo = parseInt(match[1], 10);  
        group.hasTrigger = true;
      }
    }


    if (group.timeout) clearTimeout(group.timeout);

    group.timeout = setTimeout(async () => {
      mediaGroups.delete(groupId);

      // Обрабатываем альбом только если где-то в нём была команда !результа3
      if (!/^!результаты/i.test(group.caption)) return;

      // Берём не больше MAX_IMAGES картинок, в порядке сообщений
      const sorted = group.photos
        .slice()
        .sort((a, b) => a.messageId - b.messageId)
        .slice(0, MAX_IMAGES);

      await processImagesArray(
        bot,
        group.chatId,
        sorted,
        group.firstMessageId, 
        group.mapNo
      );
    }, 800);
  });
};

/* ===================== ОБРАБОТКА МАССИВА КАРТИНОК ===================== */

async function processImagesArray(bot, chatId, items, replyToMessageId, numberMap) {
  console.log('massiv');
  console.log(numberMap);
  const clanId = await getClanId(chatId);
  if (!process.env.GEMINI_API_KEY) {
    return bot.sendMessage(chatId, '❌ Нет GEMINI_API_KEY', {
      reply_to_message_id: replyToMessageId,
    });
  }

  await bot.sendMessage(
    chatId,
    `⏳ Обрабатываю ${items.length} скрин(ов) через Gemini...`,
    { reply_to_message_id: replyToMessageId }
  );

  // сортируем по порядку сообщений (1-я страница → 2-я → 3-я)
  const sorted = [...items].sort((a, b) => a.messageId - b.messageId);

  const allTeams = [];

  for (const item of sorted) {
    try {
      const fileLink = await bot.getFileLink(item.fileId);
      const pageTeams = await extractTeamsFromImageUrl(fileLink);
      allTeams.push(...pageTeams);
    } catch (err) {
      console.error('Ошибка обработки скрина:', err);
      await bot.sendMessage(
        chatId,
        '⚠ Ошибка распознавания одного из скринов: ' + err.message,
        { reply_to_message_id: replyToMessageId }
      );
    }
  }

  if (!allTeams.length) {
    return bot.sendMessage(
      chatId,
      '❌ Не удалось распознать ни одной команды.',
      { reply_to_message_id: replyToMessageId }
    );
  }

  const sortedWithPts = calcAndSortTeams(allTeams);
 
  // Финальный JSON
  const json = JSON.stringify(sortedWithPts, null, 2);
  const messageText = formatTeamsMessage(sortedWithPts);
  const headerResult = `Результаты карты №${numberMap}\n\n`;
  const texMsg = headerResult + messageText;
 bot.sendMessage(chatId, texMsg , {
     reply_to_message_id: replyToMessageId 
  }); 
  
  const withRank = sortedWithPts.map((t, i) => ({
    ...t,
    rank: i + 1
  }));

  /*bot.sendMessage(chatId, messageText, {
    reply_to_message_id: replyToMessageId,
  });*/
  
  // сохраняем в БД уже по clan_id
  try {
    await  saveMapResultToDb(1, numberMap, sortedWithPts);
  } catch (err) {
  
  }

  // Без parse_mode, чтобы не мучиться с экранированием
 /* return bot.sendMessage(chatId, messageText, {
    reply_to_message_id: replyToMessageId,
  }); */
}

function formatTeamsMessage(teams) {
  if (!Array.isArray(teams) || !teams.length) {
    return "Нет данных.";
  }

  const lines = [];

  teams.forEach((team, index) => {
    const num = index + 1;

    // игроки в строку: "ник1 + ник2 + ник3"
    const names = team.players.map(p => p.name).join(" + ");

    const totalPts = team.totalPts ?? 0;
    const kills = team.totalKills ?? 0;
    const placementPts = team.placementPts ?? 0;

    lines.push(
      `${num}) ${names} — ${totalPts} pts (${kills} киллов + ${placementPts} плейсмент)`
    );
  });

  return lines.join("\n");
}

