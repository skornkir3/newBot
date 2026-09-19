// handlers/cmd.marry.proposal.js
const pool = require('../handlers/db');

// валидация @тега (как у Telegram)
const TAG_RE = /^@[A-Za-z0-9_]{5,32}$/;

function lcTag(s) {
  if (!s) return null;
  s = s.trim();
  if (!s.startsWith('@')) return null;
  return s.toLowerCase();
}

async function findMemberByTagLC(tagLC) {
  const q = `
    SELECT actor_id, telegram_tag, nickname
    FROM clan_members
    WHERE LOWER(telegram_tag) = $1
      AND active = TRUE
    LIMIT 1`;
  const { rows } = await pool.query(q, [tagLC]);
  return rows[0] || null;
}

async function hasActiveMarriage(chatId, actorId) {
  const q = `
    SELECT 1 FROM marriages
    WHERE chat_id = $1 AND ended_at IS NULL
      AND ($2 IN (partner_a_id, partner_b_id))
    LIMIT 1`;
  const { rowCount } = await pool.query(q, [chatId, actorId]);
  return rowCount > 0;
}

module.exports = function marryProposal(bot) {
  // команда: брак @user
  bot.onText(/^!брак\s+(\S+)$/i, async (msg, match) => {
    console.log('marry');
    const chatId = msg.chat.id;
    const initiatorActor = msg.from.id;
    const rawTag = match[1];
    const tagLC = lcTag(rawTag);

    // 1) валидация
    if (!tagLC || !TAG_RE.test(tagLC)) {
      return bot.sendMessage(chatId,
        '❌ Укажи тег с собакой: `брак @username`',
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
    }

    try {
      // 2) найдём адресата по тегу
      const target = await findMemberByTagLC(tagLC);
      if (!target?.actor_id) {
        return bot.sendMessage(chatId,
          '❌ Пользователь не найден или у него не заполнен actor_id.',
          { reply_to_message_id: msg.message_id });
      }
      const targetActor = target.actor_id;

      if (targetActor === initiatorActor) {
        return bot.sendMessage(chatId, '❌ Нельзя сделать предложение самому себе.', {
          reply_to_message_id: msg.message_id,
        });
      }

      // 3) проверки браков
      if (await hasActiveMarriage(chatId, initiatorActor) ||
          await hasActiveMarriage(chatId, targetActor)) {
        return bot.sendMessage(chatId, '❌ Один из вас уже состоит в браке в этом чате.', {
          reply_to_message_id: msg.message_id,
        });
      }

      // 4) проверим активную заявку между этими людьми
      const dupe = await pool.query(
        `SELECT id FROM marriage_proposals
         WHERE chat_id = $1 AND proposer_id = $2 AND target_id = $3 AND status = 'pending'
         LIMIT 1`,
        [chatId, initiatorActor, targetActor]
      );
      if (dupe.rowCount) {
        return bot.sendMessage(chatId, '⌛ Предложение уже отправлено, ждём ответ.', {
          reply_to_message_id: msg.message_id,
        });
      }

      // 5) отправим карточку с кнопками
      const targetName = target.nickname || target.telegram_tag || 'пользователь';
      const text =
        `💍 ${targetName}, минутку внимания.\n` +
        `💖 ${msg.from.first_name} сделал(а) вам предложение руки и сердца.\n` +
        `Примите решение кнопкой ниже.`;

      const keyboard = {
        inline_keyboard: [[
          { text: '💖 Согласиться', callback_data: 'marry:ok' },
          { text: '💔 Отказать',     callback_data: 'marry:no' }
        ]]
      };

      const sent = await bot.sendMessage(chatId, text, {
        reply_to_message_id: msg.message_id,
        reply_markup: keyboard,
      });

      // 6) создаём заявку
      const { rows } = await pool.query(
        `INSERT INTO marriage_proposals (chat_id, proposer_id, target_id, message_id)
         VALUES ($1,$2,$3,$4)
         RETURNING id`,
        [chatId, initiatorActor, targetActor, sent.message_id]
      );
      const proposalId = rows[0].id;

      // привяжем proposalId к сообщению через локальную Map, но лучше парсить из DB по message_id
      // здесь нам не нужно хранить его в callback_data (ограничение 64b), т.к. достанем по message_id в обработчике.
    } catch (e) {
      console.error('marry proposal error', e);
      bot.sendMessage(chatId, '⚠️ Не удалось отправить предложение.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });

  // обработчик нажатий кнопок
  bot.on('callback_query', async (cq) => {
    const data = cq.data || '';
    if (!data.startsWith('marry:')) return;

    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;
    const clickerActor = cq.from.id;

    try {
      // найдём активную заявку по message_id
      const { rows } = await pool.query(
        `SELECT id, proposer_id, target_id, chat_id, status
         FROM marriage_proposals
         WHERE chat_id = $1 AND message_id = $2
         LIMIT 1`,
        [chatId, messageId]
      );
      const p = rows[0];
      if (!p || p.status !== 'pending') {
        await bot.answerCallbackQuery(cq.id, { text: 'Заявка неактивна.', show_alert: true });
        return;
      }

      // Разрешаем нажимать только адресату
      if (clickerActor !== Number(p.target_id)) {
        await bot.answerCallbackQuery(cq.id, { text: 'Это предложение не вам.', show_alert: true });
        return;
      }

      if (data === 'marry:no') {
        await pool.query(
          `UPDATE marriage_proposals SET status = 'declined' WHERE id = $1`,
          [p.id]
        );
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        await bot.sendMessage(chatId, '💔 Предложение отклонено.');
        await bot.answerCallbackQuery(cq.id);
        return;
      }

      // Дополнительная защита: убедимся, что никто не успел вступить в брак за время ожидания
      const busy = await pool.query(
        `SELECT 1 FROM marriages
         WHERE chat_id = $1 AND ended_at IS NULL
           AND ($2 IN (partner_a_id, partner_b_id) OR
                $3 IN (partner_a_id, partner_b_id))
         LIMIT 1`,
        [chatId, p.proposer_id, p.target_id]
      );
      if (busy.rowCount) {
        await bot.answerCallbackQuery(cq.id, { text: 'Кто-то уже состоит в браке.', show_alert: true });
        await pool.query(`UPDATE marriage_proposals SET status = 'declined' WHERE id = $1`, [p.id]);
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        return;
      }

      // создаём брак
      await pool.query(
        `INSERT INTO marriages (chat_id, partner_a_id, partner_b_id, created_by)
         VALUES ($1,$2,$3,$4)`,
        [chatId, p.proposer_id, p.target_id, p.target_id]
      );
      await pool.query(
        `UPDATE marriage_proposals SET status = 'accepted' WHERE id = $1`,
        [p.id]
      );

      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });

      // имена для красивого текста
      const getName = async (actorId) => {
        const { rows } = await pool.query(
          `SELECT COALESCE(nickname, telegram_tag) AS name
           FROM clan_members
           WHERE actor_id = $1
           LIMIT 1`,
          [actorId]
        );
        return rows[0]?.name || `ID ${actorId}`;
        };
      const aName = await getName(p.proposer_id);
      const bName = await getName(p.target_id);

      await bot.sendMessage(chatId, `💍 С сегодняшнего дня ${aName} и ${bName} состоят в браке! 🎉`);
      await bot.answerCallbackQuery(cq.id);
    } catch (e) {
      console.error('marry callback error', e);
      try { await bot.answerCallbackQuery(cq.id, { text: 'Ошибка. Попробуйте позже.', show_alert: true }); } catch {}
    }
  });

  // (опционально) Крон-очистка протухших заявок (например, 24 часа)
  setInterval(async () => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE marriage_proposals
         SET status = 'expired'
         WHERE status = 'pending' AND created_at < now() - interval '1 hours'`
      );
      if (rowCount) {
        // можно дополнительно убирать клавиатуры у старых сообщений, если нужно
      }
    } catch {}
  }, 60_000); // раз в минуту
};
