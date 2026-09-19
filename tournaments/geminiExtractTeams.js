// geminiExtractTeams.js
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠ GEMINI_API_KEY не задан в переменных окружения');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Можно использовать flash-модель, она дёшево и быстро работает с картинками
const model = genAI
  ? genAI.getGenerativeModel({ 
   // model: 'gemini-1.5-flash' 
    model: "gemini-2.5-flash"
  })
  : null;

/**
 * Анализирует один скриншот результатов турнира.
 * Возвращает массив команд:
 * [
 *   {
 *     place: 1,
 *     players: [
 *       { name: "Игрок1", kills: 5 },
 *       { name: "Игрок2", kills: 3 }
 *     ],
 *     totalKills: 8
 *   },
 *   ...
 * ]
 */
async function extractTeamsFromImageUrl(imageUrl) {
  if (!GEMINI_API_KEY || !model) {
    throw new Error('Нет GEMINI_API_KEY для работы с Gemini API');
  }

  // 1) Скачиваем картинку по ссылке Telegram
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error('HTTP error while downloading image: ' + res.status);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  // 2) Промпт для Gemini
  const prompt = `
Ты видишь скриншот турнирной таблицы PUBG Mobile (командный режим: от 1 до 4 игроков в команде).

Нужно:
1) Для КАЖДОЙ команды определить:
   - place: её место в таблице (целое число). Если место не видно, поставь null.
   - игроков: от 1 до 4 игроков в команде.
     Для каждого игрока:
        * name — ник (строка).
        * kills — количество убийств (целое число).
   - totalKills — суммарные убийства команды (целое число).

2) Если на скрине есть строки, которые не являются командами (заголовки, итоги и т.п.), не включай их в результат.

3) Верни ТОЛЬКО JSON в формате:

[
  {
    "place": 1,
    "players": [
      { "name": "Игрок1", "kills": 5 },
      { "name": "Игрок2", "kills": 3 }
    ],
    "totalKills": 8
  }
]

Только JSON, без комментариев, без пояснений, без текста вокруг.
`;

  const geminiRes = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const jsonText = geminiRes.response.text().trim();

  let clean = jsonText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Также убираем случайные префиксы типа "json\n"
  clean = clean.replace(/^json\s*/i, '').trim();
  
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error(
      'Gemini вернул невалидный JSON: ' +
        err.message +
        '\nRAW:\n' +
        jsonText.slice(0, 1000)
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Ожидался массив команд от Gemini');
  }

  // Лёгкая нормализация
  const teams = parsed.map((t) => {
    const place =
      typeof t.place === 'number'
        ? t.place
        : t.place == null
        ? null
        : parseInt(String(t.place).trim(), 10);

    const players = Array.isArray(t.players) ? t.players : [];
    const normPlayers = players
      .map((p) => ({
        name: (p.name || '').toString().trim(),
        kills: Number.parseInt(String(p.kills || '0'), 10) || 0,
      }))
      .filter((p) => p.name.length > 0);

    const totalKills =
      typeof t.totalKills === 'number'
        ? t.totalKills
        : normPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);

    return {
      place: Number.isFinite(place) ? place : null,
      players: normPlayers.slice(0, 4), // не больше 4-х игроков
      totalKills,
    };
  });

  return teams.filter((t) => t.players.length > 0);
}

module.exports = extractTeamsFromImageUrl;
