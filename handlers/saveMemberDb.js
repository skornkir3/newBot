const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL});

async function saveMemberDb(data) {
  const {
    name,
    nick,
    target_username,
    age,
    pubg_id,
    city,
    clan,
    actor_id,
    clan_id
  } = data;

  const client = await pool.connect();
  try {
    const now = new Date();

    // 1. Ищем по actor_id
    const checkByActorId = await client.query(
      'SELECT id FROM public.clan_members WHERE actor_id = $1',
      [actor_id]
    );

    if (checkByActorId.rows.length > 0) {
      // 🔁 Обновляем по actor_id
      const result  = await client.query(
        `UPDATE public.clan_members
         SET name = $1, nickname = $2, telegram_tag = $3, age = $4,
             pubg_id = $5, city = $6, clan = $7, created_at = $8, clan_id = $10
         WHERE actor_id = $9
         RETURNING id`,
        [name, nick, target_username, age, pubg_id, city, clan, now, actor_id, clan_id]
      );
      return { status: 'updated_by_actor_id', id: result.rows[0].id };
    }
 
    // 2. Ищем по тегу, если actor_id нет
    const checkByTag = await client.query(
      'SELECT id FROM public.clan_members WHERE telegram_tag = $1',
      [target_username]
    );

    if (checkByTag.rows.length > 0) {
      // 🔁 Обновляем по тегу
      const result  =  await client.query(
        `UPDATE public.clan_members
         SET name = $1, nickname = $2, age = $3, pubg_id = $4, city = $5, clan = $6, created_at = $7, actor_id = $8, clan_id = $10
         WHERE telegram_tag = $9
         RETURNING id`,
        [name, nick, age, pubg_id, city, clan, now, actor_id, target_username, clan_id]
      );
      return { status: 'updated_by_tag', id: result.rows[0].id };
    }

    // 3. Если не найдено — создаём нового
    const result  = await client.query(
      `INSERT INTO public.clan_members 
  (name, nickname, telegram_tag, age, pubg_id, city, clan, created_at, actor_id, clan_id, active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING id 
`,
      [name, nick, target_username, age, pubg_id, city, clan, now, actor_id, clan_id]
    );
    return { status: 'created', id: result.rows[0].id};

  } catch (error) {
    console.error('❌ Ошибка сохранения в БД:', error);
    return { status: 'error', error };
  } finally {
    client.release();
  }
}

module.exports = saveMemberDb;