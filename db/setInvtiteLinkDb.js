// subclan/setInviteLinkByNumber.js
const db = require('../handlers/db');

/**
 * Обновить invite_link у подклана по номеру внутри клана.
 * @param {number} clanId    - id клана (public.clans.id)
 * @param {number} number    - номер подклана внутри клана (public.subclans.number)
 * @param {string} inviteLink
 * @returns {Promise<object>} обновлённая строка subclans
 */
module.exports = async function setInviteLinkByNumber(clanId, number, inviteLink) {
  if (!clanId || !number || !inviteLink) {
    throw new Error('Не указан clanId, number или inviteLink');
  }
  console.log(clanId, number, inviteLink);

  const q = `
    UPDATE public.subclans
       SET invite_link = $1,
           updated_at  = NOW()
     WHERE clan_id = $2
       AND number  = $3
     RETURNING *;
  `;
  const res = await db.query(q, [inviteLink, clanId, number]);
  if (res.rowCount === 0) {
    throw new Error('Подклан с таким номером в этом клане не найден');
  }
  return res.rows[0];
};
