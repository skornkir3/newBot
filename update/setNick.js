const { Pool } = require("pg");
const isAdminChat = require('./../admin/permissionAdminChat');

// Подключение к Postgres
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = function (bot) {
  bot.onText(/^\+ник(?:\s+@(\S+)\s+(.+)|\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromUser = msg.from.username ? `@${msg.from.username}` : null;

    const isAdminCommand = !!match[1];

    // targetTag СНАЧАЛА определяем и валидируем
    let targetTag = match[1] ? match[1] : fromUser;
    if (!targetTag) {
      return bot.sendMessage(
        chatId,
        "❌ У тебя нет @тега в Telegram. Добавь его в настройках.",
        { reply_to_message_id: msg.message_id }
      );
    }

    // нормализация тега
    targetTag = String(targetTag).trim().toLowerCase();
    if (!targetTag.startsWith("@")) targetTag = "@" + targetTag;

    const newNickname = (match[2] || match[3] || "").trim();
    if (!newNickname) {
      return bot.sendMessage(
        chatId,
        "❌ Укажи ник после команды `+ник`.",
        { reply_to_message_id: msg.message_id }
      );
    }

    // Проверка прав на админ-команду
    if (isAdminCommand && !(await isAdminChat(chatId))) {
      console.log("Admin");
      return;
    }

    try {
      // --- Обновляем в PostgreSQL ---
      await pool.query(
        `UPDATE clan_members SET nickname = $1 WHERE lower(telegram_tag) = lower($2)`,
        [newNickname, targetTag]
      );

      return bot.sendMessage(
        chatId,
        `✅ Ник для ${targetTag} обновлён: ${newNickname}`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      console.error("Ошибка при обновлении ника:", err);
      return bot.sendMessage(
        chatId,
        "❌ Ошибка при сохранении ника.",
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
