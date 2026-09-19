const db = require('../handlers/db');

module.exports = async function addGameClassicMode(id) {
    const sql = `
    insert into public.member_modes (member_id, mode_id)
    values ($1, 1)
  `;
    try {
        const res = await db.query(sql, [id]);
        return res.rows[0];
    } catch (err) {
        if (err?.message?.includes('clan_invites_clan_code_uidx')) {
            err.retryable = true;
        }
        throw err;
    }
};
