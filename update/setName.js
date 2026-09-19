const { Pool } = require("pg");
const isAdminChat = require("./../admin/permissionAdminChat");
const getPlayerDescription = require("./../db/getDescriptionDb");
const { google } = require("googleapis");
const getClanId = require('../clan/getClanId');

// ===== Настройка индекса колонки "Имя" в Google Sheets =====
const NAME_COL_INDEX = 0;

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

function normalizeTag(tagMaybe) {
  if (!tagMaybe) return null;
  let t = tagMaybe.trim().toLowerCase();
  if (!t.startsWith("@")) t = "@" + t;
  return t;
}

module.exports = function (bot, auth, SPREADSHEET_ID) {
  // +имя @user Новое Имя   |  +имя Новое Имя (для себя)
  bot.onText(/^\+имя(?:\s+@(\S+)\s+(.+)|\s+(.+))?$/iu, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromUser = msg.from.username ? `@${msg.from.username}` : null;

    // режим: указан @ => админ-команда (можно менять чужое имя)
    const isAdminCommand = !!match[1];
    let targetTag = isAdminCommand ? match[1] : fromUser;
    targetTag = normalizeTag(targetTag);

    const newName = match[2] || match[3]; // строка после команды
    if (!newName) {
      return bot.sendMessage(
        chatId,
        "❌ Укажи имя после команды `+имя`.",
        { reply_to_message_id: msg.message_id }
      );
    }

    if (isAdminCommand && !await isAdminChat(chatId)) {
      // тихий выход, как и в твоём +ник
      return;
    }

    if (!targetTag) {
      return bot.sendMessage(
        chatId,
        "❌ У тебя нет @тега в Telegram. Добавь его в настройках.",
        { reply_to_message_id: msg.message_id }
      );
    }

    try {
      // Получаем карточку игрока (нам нужны clan и actor_id)
      const player = await getPlayerDescription(targetTag);
      if (!player) {
        return bot.sendMessage(
          chatId,
          `❌ Игрок с тегом ${targetTag} не найден в базе.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      // --- Обновляем в PostgreSQL ---
      // приоритет: actor_id -> иначе по тегу
      if (player.actor_id) {
        await pool.query(
          `UPDATE clan_members SET name = $1 WHERE actor_id = $2`,
          [newName, player.actor_id]
        );
      } else {
        await pool.query(
          `UPDATE clan_members SET name = $1 WHERE lower(telegram_tag) = lower($2)`,
          [newName, targetTag]
        );
      }

      const clanId = await getClanId(chatId);
      if(clanId){


      // --- Обновляем в Google Sheets ---
      // ищем строку по тегу (как в +ник), меняем колонку имени
      const sheets = await getSheets();
      const range = "Clan" + player.clan; // как у тебя в +ник
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });

      const rows = res.data.values || [];
      let updated = false;
      const targetTagLower = targetTag.toLowerCase();

      for (let i = 0; i < rows.length; i++) {
        // предположим, что тег — в колонке C (индекс 2), как в твоём +ник
        const tgCell = rows[i][2];
        if (tgCell && tgCell.toLowerCase() === targetTagLower) {
          // ставим имя в выбранную колонку
          rows[i][NAME_COL_INDEX] = newName;
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
      await bot.sendMessage(
        chatId,
        `✅ Имя для ${targetTag} обновлено: ${newName}`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      console.error("Ошибка при обновлении имени:", err);
      await bot.sendMessage(
        chatId,
        "❌ Ошибка при сохранении имени.",
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
