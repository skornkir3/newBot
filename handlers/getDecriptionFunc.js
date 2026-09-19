const { google } = require('googleapis');
require('dotenv').config();

const SHEET_NAME = 'Clan';

async function getPlayerDescription(username, auth, spreadsheetId) {
  if (!username.startsWith('@')) {
    username = '@' + username;
  }

  const usernameLower = username.toLowerCase();

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_NAME,
    });

    const rows = res.data.values || [];
    const usernameIndex = 2;

    const playerRow = rows.find((row, index) => {
      if (index === 0) return false;
      const cellValue = (row[usernameIndex] || '').toLowerCase();
      return cellValue === usernameLower;
    });

    if (!playerRow) return null;

    return {
      name: playerRow[0] || '—',
      nick: playerRow[1] || '—',
      username,
      pubgId: playerRow[3] || '—',
      age: playerRow[4] || '—',
      city: playerRow[5] || '—'
    };
  } catch (err) {
    console.error('❌ Ошибка при получении описания:', err.message);
    throw err;
  }
}

module.exports = getPlayerDescription;

