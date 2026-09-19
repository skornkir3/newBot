const pool = require('./db');
const getClanId = require('../clan/getClanId');

// Экранируем ВСЮ строку целиком под MarkdownV2
function escapeMdV2(s) {
  if (!s) return '—';
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendMdV2(bot, chatId, text) {
  return bot.sendMessage(chatId, escapeMdV2(text), { parse_mode: 'MarkdownV2' });
}

module.exports = function watchUsernameChanges(bot, notifyChatId, SpeadSheetId) {
  const autoUpdate = false;
  const cooldownMinutes = 360; // 6 часов

  const lastNotifiedAt = new Map();

  bot.on('message', async (msg) => {
    try {
      if (!msg || !msg.chat || !msg.from) return;
      if (!['group', 'supergroup'].includes(msg.chat.type)) return;

      const actorId = msg.from.id;
      const currentUsername = msg.from.username ? `@${msg.from.username}` : null;
      const now = Date.now();
      const last = lastNotifiedAt.get(actorId) || 0;
      if (now - last < cooldownMinutes * 60 * 1000) return;

      const { rows } = await pool.query(
        `SELECT telegram_tag, pubg_id, clan_id
           FROM clan_members
          WHERE actor_id = $1
          LIMIT 1`,
        [actorId]
      );
      if (rows.length === 0) return;

      const dbTag = rows[0].telegram_tag || null;
      const pubgId = rows[0].pubg_id || null;
      const clanId = rows[0].clan_id || null;
      if (clanId != 1) {return;}
      const norm = (s) => (s ? s.trim().toLowerCase() : null);
      if (norm(dbTag) === norm(currentUsername)){
        return;
      } 
      const whoRaw = msg.from.username
        ? `@${msg.from.username}`
        : `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

      const rawNotice =
        `⚠️ Пользователь ${whoRaw} изменил username\n` + // ← убрал точку в конце
        `В базе: ${dbTag || '—'}\n` +
        `Сейчас: ${currentUsername || '—'}\n` +
        `pubg id: ${pubgId}`;

      const targetChatId = notifyChatId ?? msg.chat.id;
      await sendMdV2(bot, targetChatId, rawNotice);

      lastNotifiedAt.set(actorId, now);

        await pool.query(
          `UPDATE clan_members
              SET telegram_tag = $2
            WHERE actor_id = $1`,
          [actorId, currentUsername]
        );

        const rawUpd = `✅ Обновил тег в базе на ${currentUsername || '—'}`; // без точки
        await sendMdV2(bot, targetChatId, rawUpd);
      
    } catch (err) {
      console.error('watchUsernameChanges error:', err);
    }
  });
};
