const db = require('../handlers/db');

module.exports = async function (clanId, number) {
  console.log('get clan');
  console.log(clanId);
  console.log(number);
  try {
    // 1️⃣ Проверяем, есть ли клан с таким admin_chat_id
    const clanRes = await db.query(
      `SELECT *
         FROM public.subclans
        WHERE clan_id = $1 and number = $2
        LIMIT 1`,
      [clanId, number]
    );
    if (clanRes.rowCount > 0) {
      console.log(clanRes.rows[0])
      return clanRes.rows[0];
    }

    return false;

  } catch (err) {
    console.error('❌ Ошибка при получении id клана:', err);
    return 0;
  }
};
