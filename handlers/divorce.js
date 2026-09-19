// modules/cmd.divorce.js
const pool = require('../handlers/db');

function escapeMarkdown(s) {
  if (!s) return '—';
  return s.replace(/_/g, '\\_').replace(/\*/g, '\\*').replace(/`/g, '\\`').replace(/\[/g, '\\[');
}

// Получить actor_id автора (по @тегу или по числу)
// Автор — msg.from: обычно actor_id = Telegram user_id.
async function resolveActorId(msg) {
  // приоритет: @username -> actor_id из Telegram
  const username = msg.from?.username ? `@${msg.from.username}` : null;
  const identifier = username || String(msg.from.id);

  const sql = `
    SELECT actor_id, telegram_tag
    FROM clan_members
    WHERE active = TRUE
      AND (telegram_tag = $1 OR actor_id::text = $1)
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [identifier]);
  return rows[0] || null; // {actor_id, telegram_tag}
}

module.exports = function (bot) {
  bot.onText(/^!развод$/iu, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const me = await resolveActorId(msg);
      if (!me) {
        return bot.sendMessage(
          chatId,
          '❗ Не нашёл тебя в базе.',
          { reply_to_message_id: msg.message_id }
        );
      }

      // 1) найдём активный брак (последний), чтобы красиво показать партнёра
      const findSql = `
        SELECT
          m.id,
          m.started_at,
          CASE WHEN m.partner_a_id = $1 THEN ub.telegram_tag ELSE ua.telegram_tag END AS partner_tag,
          CASE WHEN m.partner_a_id = $1 THEN ub.name         ELSE ua.name         END AS partner_name
        FROM marriages m
        JOIN clan_members ua ON ua.actor_id = m.partner_a_id
        JOIN clan_members ub ON ub.actor_id = m.partner_b_id
        WHERE m.ended_at IS NULL
          AND ($1 = m.partner_a_id OR $1 = m.partner_b_id)
        ORDER BY m.started_at DESC
        LIMIT 1;
      `;
      const found = await pool.query(findSql, [me.actor_id]);
      if (!found.rows.length) {
        return bot.sendMessage(
          chatId,
          'ℹ️ Активных отношений не найдено.',
          { reply_to_message_id: msg.message_id }
        );
      }

      const partnerTag = found.rows[0].partner_tag || found.rows[0].partner_name || 'партнёр';

      // 2) помечаем как завершённые (мягкое удаление)
      const endSql = `
        WITH target AS (
          SELECT id
          FROM marriages
          WHERE ended_at IS NULL
            AND ($1 = partner_a_id OR $1 = partner_b_id)
          ORDER BY started_at DESC
          LIMIT 1
        )
        UPDATE marriages m
        SET ended_at = NOW()
        FROM target
        WHERE m.id = target.id
        RETURNING m.id;
      `;
      const ended = await pool.query(endSql, [me.actor_id]);

      if (!ended.rows.length) {
        // крайне маловероятно, но вдруг гонка
        return bot.sendMessage(
          chatId,
          '⚠️ Не удалось завершить отношения (возможно, они уже завершены).',
          { reply_to_message_id: msg.message_id }
        );
      }

      // Готовим ответ
      const meLabel = me.telegram_tag ? escapeMarkdown(me.telegram_tag) : escapeMarkdown(String(msg.from.first_name || 'Игрок'));
      const partnerLabel = escapeMarkdown(partnerTag);

      await bot.sendMessage(
        chatId,
        `✅ Разрыв оформлен.\n${meLabel} и ${partnerLabel} больше не в отношениях.`,
        { reply_to_message_id: msg.message_id, parse_mode: 'Markdown' }
      );

    } catch (err) {
      console.error('Ошибка в !развод:', err);
      await bot.sendMessage(chatId, '❌ Ошибка при выполнении команды !развод.', {
        reply_to_message_id: msg.message_id
      });
    }
  });
};
