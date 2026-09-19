const db = require('../handlers/db');

module.exports = async function createSubclan(clanId, leaderActorId, memberLimit, inviteLink) {
  console.log('db');
  console.log(clanId);

  const limit = Number(memberLimit);

  try {
    // 🔹 1. Получаем текущее количество подкланов по clan_id
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM public.subclans
       WHERE clan_id = $1`,
      [clanId]
    );

    const nextNumber = (countRes.rows[0]?.count || 0) + 1;

    // 🔹 2. Вставляем новую запись с полем number
    const insertRes = await db.query(
      `INSERT INTO public.subclans (clan_id, leader_actor_id, invite_link, member_limit, number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clan_id, leader_actor_id, invite_link, member_limit, number, active, created_at, updated_at`,
      [clanId, leaderActorId, inviteLink, limit, nextNumber]
    );

    await db.query(
      'UPDATE clan_members SET clan = $2 WHERE actor_id = $1',
      [leaderActorId, nextNumber]
    );

    return insertRes.rows[0];
  } catch (err) {
    // 🔹 Проверка на уникальность лидера
    if (err?.message?.includes('subclans_leader_active_uidx')) {
      throw new Error('Этот лидер уже возглавляет активный подклан в этом клане');
    }
    throw err;
  }
};
