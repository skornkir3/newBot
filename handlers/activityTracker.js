// handlers/activityTracker.js
const pool = require('./db');

const COUNTABLE_TYPES = new Set([
  'text','photo','video','animation','sticker','document',
  'audio','voice','video_note','contact','location','venue'
]);

function isCountable(msg, botId) {
  if (!msg) return false;
  if (msg.from?.is_bot) return false;
  if (botId && msg.from?.id === botId) return false;
  if (msg.chat?.type === 'channel') return false;
  if (msg.new_chat_members || msg.left_chat_member || msg.pinned_message) return false;
  for (const t of COUNTABLE_TYPES) if (msg[t] !== undefined) return true;
  return false;
}

async function recordActivity(msg, tz = 'Europe/Berlin') {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO message_stats_daily (chat_id, user_id, day, msg_count)
      VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE $3)::date, 1)
      ON CONFLICT (chat_id, user_id, day)
      DO UPDATE SET msg_count = message_stats_daily.msg_count + 1
    `, [chatId, userId, tz]);

    await client.query(`
      INSERT INTO user_activity_totals (chat_id, user_id, total_count, last_msg_at)
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT (chat_id, user_id)
      DO UPDATE SET
        total_count = user_activity_totals.total_count + 1,
        last_msg_at = GREATEST(user_activity_totals.last_msg_at, EXCLUDED.last_msg_at)
    `, [chatId, userId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[activityTracker] recordActivity error:', e);
  } finally {
    client.release();
  }
}

async function getUserStats(chatId, userId) {
  const { rows: totalRows } = await pool.query(
    `SELECT total_count, last_msg_at
     FROM user_activity_totals
     WHERE user_id = $1`,
    [userId]
  );
  const total = totalRows[0] || { total_count: 0, last_msg_at: null };

  const { rows: r7 } = await pool.query(
    `SELECT COALESCE(SUM(msg_count),0) AS c
     FROM message_stats_daily
     WHERE user_id = $1
       AND day >= (CURRENT_DATE - INTERVAL '6 day')`,
    [userId]
  );

  const { rows: r30 } = await pool.query(
    `SELECT COALESCE(SUM(msg_count),0) AS c
     FROM message_stats_daily
     WHERE user_id = $1
       AND day >= (CURRENT_DATE - INTERVAL '29 day')`,
    [userId]
  );

  return {
    total: Number(total.total_count || 0),
    lastMsgAt: total.last_msg_at || null,
    week: Number(r7[0]?.c || 0),
    month: Number(r30[0]?.c || 0),
  };
}

async function getTopActive(chatId, days = 7, limit = 10) {
  const { rows } = await pool.query(
    `SELECT user_id, SUM(msg_count) AS cnt
     FROM message_stats_daily
     WHERE chat_id = $1
       AND day >= (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')
     GROUP BY user_id
     ORDER BY cnt DESC
     LIMIT $3`,
    [chatId, days, limit]
  );
  return rows.map(r => ({ user_id: r.user_id, count: Number(r.cnt) }));
}

// === Экспорт и навеска ===
// Экспортируем И функцию-инициализатор, И утилиты для других модулей.
function attachActivity(bot) {
  const BOT_ID_PROMISE = bot.getMe().then(me => me.id).catch(() => null);
  bot.on('message', async (msg) => {
    const botId = await BOT_ID_PROMISE;
    if (!isCountable(msg, botId)) return;
    await recordActivity(msg);
  });
}

module.exports = attachActivity;
module.exports.getUserStats = getUserStats;
module.exports.getTopActive = getTopActive;

// опционально, если где-то пригодится
module.exports._isCountable = isCountable;
module.exports._recordActivity = recordActivity;

