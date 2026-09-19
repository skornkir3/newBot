
// premium/addSubscription.js
const db = require('../handlers/db');
const { PREMIUM_DURATION_DAYS } = require('./config');

// =============== ADD / EXTEND PREMIUM ==================
async function addPremium(userId, chatId, amountXtr) {
  const res = await db.query(
    `
    INSERT INTO premium_subscriptions (user_id, chat_id, premium_until, total_payments_xtr)
    VALUES ($1, $2, NOW() + INTERVAL '${PREMIUM_DURATION_DAYS} days', $3)
    ON CONFLICT (user_id)
    DO UPDATE SET
      premium_until =
        GREATEST(premium_subscriptions.premium_until, NOW())
        + INTERVAL '${PREMIUM_DURATION_DAYS} days',
      total_payments_xtr = premium_subscriptions.total_payments_xtr + EXCLUDED.total_payments_xtr,
      chat_id = EXCLUDED.chat_id,
      updated_at = NOW()
    RETURNING *;
    `,
    [userId, chatId, amountXtr]
  );

  return res.rows[0];
}

// =============== CHECK PREMIUM ==================
async function hasPremium(userId) {
  const res = await db.query(
    `
    SELECT premium_until
    FROM premium_subscriptions
    WHERE user_id = $1 AND premium_until > NOW()
    LIMIT 1
    `,
    [userId]
  );

  return res.rowCount > 0;
}

// =============== GET INFO ==================
async function getPremiumInfo(userId) {
  const res = await db.query(
    `
    SELECT *
    FROM premium_subscriptions
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return res.rows[0] || null;
}

// =============== EXPORT ==================
module.exports = {
  addPremium,
  hasPremium,
  getPremiumInfo
};
