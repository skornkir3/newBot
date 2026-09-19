const { google } = require('googleapis');
const db = require('./db');

const SHEET_NAME = 'Clan';

module.exports = function (bot, auth, SPREADSHEET_ID) {
  bot.onText(/!обновитьбазу/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

 /*   if (userId !== 123456789) { // замените на свой Telegram ID
      return bot.sendMessage(chatId, '❌ У тебя нет доступа к этой команде.');
    } */

    try {
      const client = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:I`,
      });

      const rows = response.data.values || [];

      await db.query('DELETE FROM clan_members');

      for (const row of rows) {
        await db.query(
          `INSERT INTO clan_members
           (name, nickname, telegram_tag, pubg_id, age, city, clan, actor_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            row[0] || null,
            row[1] || null,
            row[2] || null,
            row[3] ? parseInt(row[3]) : null,
            row[4] || null,
            row[5] || null,
            row[6] ? parseInt(row[6]) : null,
            row[7] ? parseInt(row[7]) : null,
            (new Date).toISOString()
          ]
        );
      }

      bot.sendMessage(chatId, '✅ Данные из Google таблицы успешно перенесены в базу.');
    } catch (err) {
      console.error('❌ Ошибка при переносе данных:', err);
      bot.sendMessage(chatId, '❌ Ошибка при обновлении базы.');
    }
  });
};
