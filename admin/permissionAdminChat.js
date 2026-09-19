
const db = require('../handlers/db');

module.exports = async function (chatId) {
  try {
    // 1️⃣ Проверяем, есть ли клан с таким admin_chat_id
    const clanRes = await db.query(
      `SELECT id AS clan_id
         FROM public.clans
        WHERE admin_chat_id = $1
        LIMIT 1`,
      [chatId]
    );

    if (clanRes.rowCount > 0) {
      return true;
    }
    return false;

  } catch (err) {
    console.error('❌ Ошибка при получении id клана:', err);
    return false;
  }
};