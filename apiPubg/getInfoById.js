// ./apiPubg/getInfoById.js
const fetch = require("node-fetch");

/**
 * Получение данных по PUBG ID через OP.GG API
 * @param {string} pubgId
 * @returns {Promise<object|null>}
 */
const pubgApiKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI3YTQ5OTUxMC1iMGU5LTAxM2UtNmVkMC0yZWY4YmJkYjNmYTUiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzY0NTk2NTM4LCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6ImNoZWNrbWF0ZSJ9.bizn9gzHB3JH0KJGpoFrv0OXljfd5HwWueZav6AFRxw";

async function getInfoById(pubgId) {
  try {
    const url = `https://pubg.op.gg/api/mobile/v1/users/${pubgId}`;
    const res = await fetch(url, { timeout: 8000 });

    if (!res.ok) {
      console.log(`❌ Ошибка API (${res.status})`);
      return null;
    }

    const data = await res.json();
    return data;

  } catch (err) {
    console.error("❌ Ошибка в getInfoById:", err);
    return null;
  }
}

module.exports = getInfoById;
