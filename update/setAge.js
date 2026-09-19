// modules/cmd.setAge.js
const { Pool } = require("pg");
const isAdminChat = require("./../admin/permissionAdminChat");
const getPlayerDescription = require("./../db/getDescriptionDb");
const { google } = require("googleapis");
const getClanId = require('../clan/getClanId');

// ===== Индексы столбцов в Google Sheets =====
// Возраст: поставь индекс колонки (A=0, B=1, C=2, ...). Например, D => 3.
const AGE_COL_INDEX = 4;
const TAG_COL_INDEX = 2;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
  // +возраст @user 18   |   +возраст 18  (для себя)
  bot.onText(/^\+возраст(?:\s+@(\S+)\s+(\d{1,3})|\s+(\d{1,3}))?$/iu, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromUser = msg.from.username ? `@${msg.from.username}` : null;

    const isAdminCommand = !!match[1];
    let targetTag = isAdminCommand ? match[1] : fromUser;
    targetTag = normalizeTag(targetTag);

    const ageStr = match[2] || match[3];
    const age = ageStr ? parseInt(ageStr, 10) : NaN;

    if (!ageStr || Number.isNaN(age)) {
      return bot.sendMessage(chatId, "❌ Укажи возраст: `+возраст 18`.", {
        reply_to_message_id: msg.message_id,
      });
    }
    // простая валидация
    if (age < 5 || age > 120) {
      return bot.sendMessage(chatId, "❌ Нереалистичный возраст. Укажи число от 5 до 120.", {
        reply_to_message_id: msg.message_id,
      });
    }

    if (isAdminCommand && !await isAdminChat(chatId)) {
      return; // как в +ник — тихо выходим
    }

    if (!targetTag) {
      return bot.sendMessage(chatId, "❌ У тебя нет @тега в Telegram. Добавь его в настройках.", {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // карточка игрока: нужен clan и actor_id
      const player = await getPlayerDescription(targetTag);
      if (!player) {
        return bot.sendMessage(chatId, `❌ Игрок ${targetTag} не найден в базе.`, {
          reply_to_message_id: msg.message_id,
        });
      }

      // --- PostgreSQL: age INT ---
      if (player.actor_id) {
        await pool.query(`UPDATE clan_members SET age = $1 WHERE actor_id = $2`, [age, player.actor_id]);
      } else {
        await pool.query(`UPDATE clan_members SET age = $1 WHERE lower(telegram_tag) = lower($2)`, [age, targetTag]);
      }

      const clanId = await getClanId(chatId);
      if(clanId){
      
      // --- Google Sheets: обновим строку по тегу ---
      const sheets = await getSheets();
      const range = "Clan" + player.clan; // как у тебя в +ник
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
      const rows = res.data.values || [];
      let updated = false;
      const targetTagLower = targetTag.toLowerCase();

      for (let i = 0; i < rows.length; i++) {
        const tgCell = (rows[i][TAG_COL_INDEX] || "").toLowerCase();
        if (tgCell === targetTagLower) {
          rows[i][AGE_COL_INDEX] = String(age); // возраст как текст/число — RAW
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

      await bot.sendMessage(chatId, `✅ Возраст для ${targetTag} обновлён: ${age}`, {
        reply_to_message_id: msg.message_id,
      });
    } catch (err) {
      console.error("Ошибка при обновлении возраста:", err);
      await bot.sendMessage(chatId, "❌ Ошибка при сохранении возраста.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
