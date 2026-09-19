// db/getBanReasonByActorId.js
const db = require('../handlers/db');

/**
 * Возвращает причину бана по actor_id из ban_reasons.
 * Если задан clanId — ищет внутри клана.
 * Берётся последняя запись (MAX id).
 *
 * @param {number} actorId
 * @param {?number} clanId
 * @returns {Promise<string|null>}
 */
module.exports = async function getBanReasonByActorId(actorId, clanId = null) {
  const params = [actorId];
  let where = `actor_id = $1`;

  if (clanId != null) {
    params.push(clanId);
    where += ` AND clan_id = $2`;
  }

  const sql = `
    SELECT reason
      FROM ban_reasons
     WHERE ${where}
     ORDER BY id DESC
     LIMIT 1
  `;

  const res = await db.query(sql, params);
  if (res.rowCount === 0) return null;

  const reason = (res.rows[0].reason || '').trim();
  return reason.length ? reason : null;
};
