const db = require('../handlers/db');

async function registerClanDb(clanName, userId, telegramTag, p, wizardState){
  console.log(p);
  console.log(userId);
  console.log(telegramTag);
  console.log(clanName);
  await db.query("BEGIN");

  // (B) создаём клан
  const insClan = await db.query(
    `INSERT INTO clans (name, owner_actor_id, is_active, invite_link)
     VALUES ($1, $2, TRUE, $3)
     RETURNING id`,
    [clanName, userId, p.clan_link],
  );
  if (insClan.rowCount === 0) {
    await db.query("ROLLBACK");
    wizardState.delete(userId);
    return bot.sendMessage(
      msg.chat.id,
      "⚠️ Клан с таким названием уже зарегистрирован.",
    );
  }
  const clanId = insClan.rows[0].id;

  // (C) сохраняем лидера в clan_members
  if(p.updatePlayer){
    await db.query(
      `UPDATE public.clan_members
          SET clan_id      = $1,
              telegram_tag = $2,
              name         = $3,
              nickname     = $4,
              pubg_id      = $5,
              age          = $6,
              city         = $7,
              active       = TRUE
        WHERE actor_id = $8`,
      [
          clanId,
          telegramTag,
          p.leader_name,
          p.leader_nick,
          p.leader_pubg_id,
          p.leader_age,
          p.leader_city,
          userId
      ]
    );
  }
  else{
    await db.query(
      `INSERT INTO clan_members
         (clan_id, actor_id, telegram_tag, name, nickname, pubg_id, age, city, active, created_at, clan)
       VALUES
         ($1,   $2,       $3,           $4,   $5,   $6,      $7,  $8, TRUE, NOW(), 1)
       ON CONFLICT (clan_id, actor_id) DO UPDATE
         SET telegram_tag = EXCLUDED.telegram_tag,
             name         = EXCLUDED.name,
             nickname     = EXCLUDED.nickname,
             pubg_id      = EXCLUDED.pubg_id,
             age          = EXCLUDED.age,
             city         = EXCLUDED.city,
             active       = TRUE`,
      [
        clanId,
        userId,
        telegramTag,
        p.leader_name,
        p.leader_nick,
        p.leader_pubg_id,
        p.leader_age,
        p.leader_city,
      ],
    );
  }
  

  // (D) создаём первый подклан
  await db.query(
    `INSERT INTO public.subclans (clan_id, leader_actor_id, invite_link, member_limit, number)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING id`,
    [clanId, userId, p.clan_link, 60],
  );

  await db.query("COMMIT");
  return clanId;
}

module.exports = registerClanDb;