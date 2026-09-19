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

// Авторизация Google Sheets
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

module.exports = function (bot, auth, SPREADSHEET_ID) {
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

      const clanId = await getClanId(chatId);
      if (clanId) {
        const player = await getPlayerDescription(targetTag);
        if (player?.clan) {
          const sheets = await getSheets();
          const range = "Clan" + player.clan;

          const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
          });

          const rows = res.data.values || [];
          const targetTagLower = targetTag.toLowerCase();

          let updated = false;
          for (let i = 0; i < rows.length; i++) {
            const rowTag = (rows[i]?.[2] || "").toLowerCase();
            if (rowTag === targetTagLower) {
              rows[i][1] = newNickname; // столбец B — Ник
              updated = true;
            }
          }

          if (updated) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range,
              valueInputOption: "RAW",
              resource: { values: rows },
            });
          }
        }
      } // ✅ закрыли if (clanId)

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
