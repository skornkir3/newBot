const { google } = require('googleapis');
require('dotenv').config();

const SHEET_NAME = 'Clan';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

let sheets; // глобальный объект, будет инициализирован 1 раз

// Инициализация авторизации и клиента Sheets
async function initSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  sheets = google.sheets({ version: 'v4', auth: client });
}

// Основная функция сохранения/обновления описания
async function saveDescription(data) {
  console.log('save');
  console.log(data);
  if (!sheets) await initSheets(); // инициализация при первом вызове

  try {
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME + data.clan
    });

    const rows = getRes.data.values || [];
    const tagIndex = 2; // колонка C = username
    let foundRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tagIndex] === String(data.target_username)) {
        foundRowIndex = i + 1;
        break;
      }
    }

    const newRow = [
      data.name || '',
      data.nick || '',
      data.target_username || '',
      data.pubg_id || '',
      data.age || '',
      data.city || '',
      data.clan || '',
      data.actor_id || '',
      data.date || '',
    ];

    if (foundRowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME + data.clan}!A${foundRowIndex}:I${foundRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [newRow],
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_NAME + data.clan,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow],
        },
      });
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении описания:', error.message);
  }
}

module.exports = saveDescription;
