const { Pool } = require("pg");
const isAdminChat = require('./../admin/permissionAdminChat');
const getPlayerDescription = require('./../db/getDescriptionDb');
const { google } = require("googleapis");
const getClanId = require('../clan/getClanId');

// Подключение к Postgres
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = function (bot, auth, SPREADSHEET_ID) {
  bot.onText(/^\+id(?:\s+@(\S+)\s+(.+)|\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromUser = msg.from.username ? `@${msg.from.username}` : null;
    console.log('id');
    // Определяем режим команды
    const isAdminCommand = !!match[1]; // если указан @тег
    let targetTag = match[1] ? match[1] : fromUser;
    // Привести к нижнему регистру
    targetTag = targetTag.toLowerCase();
    // Проверка, есть ли @ в начале
    if (!targetTag.startsWith('@')) {
      targetTag = '@' + targetTag;
    }
    const newPubgId = match[2] || match[3];
    console.log(newPubgId);

    if (!newPubgId) {
      return bot.sendMessage(chatId, "❌ Укажи id после команды `+id`.", { reply_to_message_id: msg.message_id });
    }

    // Проверка: если команда с тегом, но не в админском чате
    if (isAdminCommand && !await isAdminChat(chatId)) {
      console.log( 'Admin');
      return ;
    }

    if (!targetTag) {
      return bot.sendMessage(chatId, "❌ У тебя нет @тега в Telegram. Добавь его в настройках.", { reply_to_message_id: msg.message_id });
    }
    const clanId = await getClanId(chatId);
   // const player  = await getPlayerDescription(targetTag);
    console.log(clanId);
    try { 
      // --- Обновляем в PostgreSQL ---
      await pool.query(
       `UPDATE clan_members SET pubg_id = $1 WHERE lower(telegram_tag) = lower($2) and clan_id = $3`,
        [newPubgId, targetTag, clanId]
      );
      bot.sendMessage(
        chatId,
        `✅ Pubg ID для ${targetTag} обновлён: ${newPubgId}`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      console.error("Ошибка при обновлении ника:", err);
      bot.sendMessage(chatId, "❌ Ошибка при сохранении id.", { reply_to_message_id: msg.message_id });
    }
  });
};
