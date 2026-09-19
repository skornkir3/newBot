const db = require('../handlers/db');

module.exports = async function (clanId) {
  try {
    // 1️⃣ Проверяем, есть ли клан с таким admin_chat_id
    const clanRes = await db.query(
      `SELECT *
         FROM public.clans
        WHERE id = $1 and is_active = true
        LIMIT 1`,
      [clanId]
    );
    if (clanRes.rowCount > 0) {
      return clanRes.rows[0];
    }

    return false;

  } catch (err) {
    console.error('❌ Ошибка при получении id клана:', err);
    return 0;
  }
};
