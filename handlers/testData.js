
return;
const { Pool } = require('pg');
require('dotenv').config(); 
const costr = "postgresql://postgres.gdbuhfgvzmrwuhgkoxxt:checkmate@aws-0-eu-north-1.pooler.supabase.com:6543/postgres";
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const { rows } = await pool.query(`
    SELECT
      current_database()   AS db,
      current_user         AS "user",
      current_schema       AS schema,
      current_setting('search_path') AS search_path,
      inet_server_addr()   AS host_ip
  `);
  console.log('DB session info:', rows[0]);

  const chk = await pool.query(`SELECT to_regclass('public.clan_members') AS exists;`);
  console.log('public.clan_members exists:', chk.rows[0].exists); // должен быть не null
  const telegramTagOrActorId = "@winepubg";
  const res = await pool.query(
    `SELECT * FROM public.clan_members 
     WHERE actor_id::text = $1 OR LOWER(telegram_tag) = LOWER($1) 
     LIMIT 1`,
    [telegramTagOrActorId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  console.log(row);
})();
