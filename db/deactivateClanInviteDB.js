// db/deactivateClanInviteDb.js
const db = require('../handlers/db');

module.exports = async function deactivateClanInviteDb(clanId, code ) {
  console.log(code)
  const res = await db.query(
    `update public.clan_invites
        set active = false
      where code = $1
      returning id, clan_id, code, active`,
    [code]
  );
  return res.rows[0] || null;
};
