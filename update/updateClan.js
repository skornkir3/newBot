const { Pool } = require("pg");
const isAdminChat = require('./../admin/permissionAdminChat');

// Подключение к Postgres
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = function (bot) {
  bot.onText(/^\+клан\s+(@\S+)?\s*(\d)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : null;
    const mentionedUser = match[1];
    const clanNumber = parseInt(match[2]);

   /* if (clanNumber < 1 || clanNumber > 5) {
      return bot.sendMessage(chatId, "❌ Клан может быть только от 1 до 5", { reply_to_message_id: msg.message_id });
    } */

    if (!await isAdminChat(chatId)) return;

    let targetUser = (mentionedUser || username).toLowerCase();
    if (!targetUser.startsWith('@')) targetUser = '@' + targetUser;

    if (!targetUser) {
      return bot.sendMessage(chatId, "❌ У тебя нет @username в Telegram. Добавь его в настройках!", { reply_to_message_id: msg.message_id });
    }
    
    try {
      // Обновляем клан в Postgres
      const updateRes = await pool.query(
        `UPDATE public.clan_members SET clan = $1 WHERE LOWER(telegram_tag) = LOWER($2) RETURNING *;`,
        [clanNumber, targetUser]
      );

      if (updateRes.rows.length === 0) {
        return bot.sendMessage(chatId, "❌ Пользователь не найден в базе", { reply_to_message_id: msg.message_id });
      }

      bot.sendMessage(chatId, `✅ Пользователь ${targetUser} теперь в клане ${clanNumber}`, { reply_to_message_id: msg.message_id });

    } catch (err) {
      console.error("Ошибка при изменении клана:", err);
      bot.sendMessage(chatId, "❌ Ошибка при изменении клана", { reply_to_message_id: msg.message_id });
    }
  });
};
