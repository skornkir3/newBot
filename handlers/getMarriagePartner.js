// db/getMarriagePartner.js
const pool = require('../handlers/db');

/**
 * Ищет активные отношения для пользователя и возвращает информацию о партнёре.
 * identifier — либо "@username", либо строковый actor_id.
 *
 * Возвращает { partner_tag, partner_name, partner_actor_id, started_at } или null.
 */
module.exports = async function getMarriagePartner(identifier) {
  // 1) Находим "себя" в clan_members (по @тегу или по actor_id)
  const meSql = `
    SELECT actor_id
    FROM clan_members
    WHERE active = TRUE
      AND (telegram_tag = $1 OR actor_id::text = $1)
    LIMIT 1;
  `;
  const meRes = await pool.query(meSql, [identifier]);
  if (!meRes.rows.length) return null;

  const myActorId = meRes.rows[0].actor_id;

  // 2) Ищем активный брак, где я = A или B
  const sql = `
    SELECT
      m.id,
      m.started_at,
      CASE WHEN m.partner_a_id = $1 THEN ub.telegram_tag ELSE ua.telegram_tag END AS partner_tag,
      CASE WHEN m.partner_a_id = $1 THEN ub.name         ELSE ua.name         END AS partner_name,
      CASE WHEN m.partner_a_id = $1 THEN ub.actor_id     ELSE ua.actor_id     END AS partner_actor_id
    FROM marriages m
    JOIN clan_members ua ON ua.actor_id = m.partner_a_id
    JOIN clan_members ub ON ub.actor_id = m.partner_b_id
    WHERE m.ended_at IS NULL
      AND ($1 = m.partner_a_id OR $1 = m.partner_b_id)
    ORDER BY m.started_at DESC
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [myActorId]);
  if (!rows.length) return null;

  const r = rows[0];
  return {
    partner_tag: r.partner_tag,
    partner_name: r.partner_name || null,
    partner_actor_id: r.partner_actor_id,
    started_at: r.started_at
  };
};
