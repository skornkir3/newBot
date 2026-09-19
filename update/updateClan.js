const { Pool } = require("pg");
const { google } = require("googleapis");
const isAdminChat = require('./../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

// Подключение к Postgres
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Авторизация в Google API
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

// Получаем ID листа по имени
async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

module.exports = function (bot, auth, SPREADSHEET_ID) {
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

      const clanId = await getClanId(chatId);
      if(clanId){

        const userData = updateRes.rows[0];
        const sheets = await getSheetsClient();

      // Удаляем пользователя из всех кланов
        for (let i = 1; i <= 5; i++) {
        const sheetName = `Clan${i}`;
        const sheetId = await getSheetIdByName(sheets, SPREADSHEET_ID, sheetName);
        if (!sheetId) continue;
        console.log(i);
        const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
        const rows = sheetData.data.values || [];
        const rowIndex = rows.findIndex(r => r[2].toLowerCase() === targetUser);
        console.log(rowIndex);
        if (rowIndex !== -1) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1
                  }
                }
              }]
            }
          });
        }
      }

      // Добавляем в новый клан
        await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `Clan${clanNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              userData.name || '',
              userData.nickname || '',
              userData.telegram_tag || '',
              userData.pubg_id || '',
              userData.age || '',
              userData.city || '',
              userData.clan || '',
              userData.actor_id || '',
              userData.date || '',
            ]
         ]
        }
      });
      }
      bot.sendMessage(chatId, `✅ Пользователь ${targetUser} теперь в клане ${clanNumber}`, { reply_to_message_id: msg.message_id });

    } catch (err) {
      console.error("Ошибка при изменении клана:", err);
      bot.sendMessage(chatId, "❌ Ошибка при изменении клана", { reply_to_message_id: msg.message_id });
    }
  });
};
