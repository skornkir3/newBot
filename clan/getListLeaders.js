const db = require('../handlers/db');

module.exports = async function getSubclanLeaders(clanId) {
  const res = await db.query(
    `SELECT leader_actor_id
       FROM public.subclans
      WHERE clan_id = $1
   ORDER BY number ASC`,
    [clanId]
  );

  // вернёт массив, например [12345, 67890, 99999]
  return res.rows.map(r => r.leader_actor_id);
};
