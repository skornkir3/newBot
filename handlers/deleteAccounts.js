// modules/cmd.deleted.js
const db = require('./db');

function escMdV2(s) {
  if (s === null || s === undefined) return '—';
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sendChunks(bot, chatId, lines, header = '', chunkSize = 8, replyTo) {
  for (let i = 0; i < lines.length; i += chunkSize) {
    const part = lines.slice(i, i + chunkSize).join('\n\n');
    await bot.sendMessage(chatId, `${header}${part}`, {
      parse_mode: 'MarkdownV2',
      reply_to_message_id: replyTo
    });
    header = '';
  }
}

module.exports = function (bot) {
  bot.onText(/^!удалённые$/iu, async (msg) => {
    const chatId = msg.chat.id;

    try {
      await bot.sendMessage(chatId, '🔎 Проверяю аккаунты…', {
        reply_to_message_id: msg.message_id
      });

      // Берём только тех, у кого actor_id задан
      const { rows: members } = await db.query(`
        SELECT id, clan, actor_id, name, nickname, telegram_tag, city
        FROM clan_members
        WHERE actor_id IS NOT NULL
        ORDER BY clan, id
      `);

      const deleted = [];
      let scanned = 0;

      for (const m of members) {
        scanned++;
        try {
          const chat = await bot.getChat(m.actor_id);

          const isDeleted =
            chat?.first_name === 'Deleted Account' &&
            !chat?.username &&
            !chat?.last_name;

          if (isDeleted) deleted.push(m);
        } catch (e) {
          const desc =
            e?.response?.body?.description ||
            e?.message ||
            String(e);

          // Считаем удалённым только явный признак
          if (desc.includes('USER_DEACTIVATED')) {
            deleted.push(m);
          } else {
            // НЕ считаем удалённым:
            // - Bad Request: chat not found
            // - Forbidden: bot was blocked by the user
            // - другие ошибки доступа/контекста
            // console.warn(`[!удалённые] not-deleted actor_id=${m.actor_id}: ${desc}`);
          }
        }

        if (scanned % 25 === 0) await sleep(80);
      }

      if (!deleted.length) {
        return bot.sendMessage(chatId, '✅ Удалённых аккаунтов не найдено.', {
          reply_to_message_id: msg.message_id
        });
      }

      const lines = deleted.map(m =>
        `• Клан ${escMdV2(m.clan ?? '—')}\n` +
        `  ID: \`${m.actor_id}\`\n` +
        `  Ник: ${escMdV2(m.nickname || m.name || '—')}\n` +
        `  Username: ${escMdV2(m.telegram_tag || '—')}\n` +
        `  Город: ${escMdV2(m.city || '—')}`
      );

      await sendChunks(bot, chatId, lines, '*Удалённые аккаунты:*\n\n', 8, msg.message_id);

    } catch (err) {
      console.error('!удалённые error:', err);
      bot.sendMessage(chatId, '❌ Ошибка при проверке аккаунтов.', {
        reply_to_message_id: msg.message_id
      });
    }
  });
};
