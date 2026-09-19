// db/getClanLimits.js
const db = require('../handlers/db');

/**
 * Получить объект лимитов подкланов по clan_id.
 * @param {number} clanId
 * @returns {Promise<object>} пример: { 1: 55, 2: 60, 3: 60 }
 */
module.exports = async function getClanLimits(clanId) {
  const res = await db.query(
    `SELECT number, member_limit
       FROM public.subclans
      WHERE clan_id = $1
        AND active = TRUE
      ORDER BY number ASC`,
    [clanId]
  );

  const limits = {};
  for (const row of res.rows) {
    limits[row.number] = row.member_limit;
  }

  return limits;
};
