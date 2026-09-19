// const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getPlayerDescription = require('./../db/getDescriptionDb');
const getAllChats = require("../clan/getClanChat");
const getClanId = require('../clan/getClanId');
// const getClanChats = require('../clan/getClanChats');

module.exports = function (bot) {
  bot.onText(/^!мут\s+@(\S+)\s+(\d+)(мин|час|ч)?\s*(.*)?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const moderator = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    // Проверка прав
    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const username = match[1] ? `@${match[1]}` : null;
    const durationValue = parseInt(match[2]);
    const durationUnit = match[3] || 'мин';
    const reason = match[4] ? match[4].trim() : 'Без причины';

    // Определяем время мута
    let durationMs = 10 * 60 * 1000; // по умолчанию 10 минут
    if (/час|ч/i.test(durationUnit)) durationMs = durationValue * 60 * 60 * 1000;
    else durationMs = durationValue * 60 * 1000;

    const untilDate = Math.floor((Date.now() + durationMs) / 1000);

    try {
      // Получаем участника по username
      const player = await getPlayerDescription(username);
      const userId = player.tgId;
      // Ограничиваем возможность писать
      const clanId = await getClanId(chatId);  
      const allChats = await getAllChats(clanId);
      for (const chat of allChats) {
      try{
       const res = await bot.restrictChatMember(chat, userId, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
         },
          until_date: untilDate
       });
      }
       catch{}
      }
      // Уведомление в чат
      await bot.sendMessage(chatId, 
        `🔇 ${username} лишается права слова на *${durationValue} ${durationUnit}*\n`,
       // `💬 Причина: ${reason}\n` +
      //  `🧑‍⚖️ Модератор: ${moderator}`, 
        { parse_mode: 'Markdown',
         reply_to_message_id: msg.message_id
        }
      );
    } catch (err) {
      console.error('Ошибка при муте:', err);
      bot.sendMessage(chatId, `❌ Не удалось выдать мут для ${username}. Возможно, бот не администратор или пользователь не найден.`, {reply_to_message_id: msg.message_id});
    }
  });
};
