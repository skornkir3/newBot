// db/getDescriptionFromDb.js
const db = require('../handlers/db'); // подключение к базе

module.exports = async function getPlayerDescriptionFromDb(telegramTagOrActorId) {
  try {
    // console.log(telegramTagOrActorId);
    const res = await db.query(
      `SELECT * FROM public.clan_members 
       WHERE actor_id::text = $1 OR LOWER(telegram_tag) = LOWER($1) 
       LIMIT 1`,
      [telegramTagOrActorId]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      name: row.name,
      nick: row.nickname,
      pubgId: row.pubg_id,
      age: row.age,
      city: row.city,
      clan: row.clan,
      tgId: row.actor_id,
      clanId: row.clan_id,
      active: row.active,
      note: row.notes,
    };
  } catch (err) {
    console.error('Ошибка при запросе из базы:', err);
    return null;
  }
};