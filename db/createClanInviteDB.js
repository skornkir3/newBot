// db/createClanInviteDb.js
const db = require('../handlers/db');

module.exports = async function createClanInviteDb({ clanId, code }) {
  const sql = `
    insert into public.clan_invites (clan_id, code, active)
    values ($1, $2, true)
    returning id, clan_id, code, active
  `;
  try {
    const res = await db.query(sql, [clanId, code]);
    return res.rows[0];
  } catch (err) {
    if (err?.message?.includes('clan_invites_clan_code_uidx')) {
      err.retryable = true;
    }
    throw err;
  }
};
