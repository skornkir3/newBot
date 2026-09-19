const db = require('../handlers/db');

module.exports = async function setMemberLimitDb(clanId, number, limit) {
  const res = await db.query(
    `UPDATE public.subclans
       SET member_limit = $3
     WHERE clan_id = $1 AND number = $2
     RETURNING id, number, member_limit`,
    [clanId, number, limit]
  );

  if (res.rowCount === 0) {
    throw new Error('Подклан с таким номером не найден.');
  }

  return res.rows[0];
};
