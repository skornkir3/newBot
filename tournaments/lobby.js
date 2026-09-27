const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

function escapeMarkdown(text) {
  if (text === null || text === undefined || text === '') return '—';
  return String(text)
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

module.exports = function registerSendLobbyCommand(bot) {
  bot.onText(/^\+лобби\s+([\s\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const lobbyText = (match?.[1] || '').trim();
    if (!lobbyText) {
      return bot.sendMessage(
        chatId,
        "ℹ️ Добавьте текст лобби на новой строке после команды:\n\n+лобби\nТекст лобби…"
      );
    }

    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // 1) Находим активный турнир
      const tRes = await db.query(
        `
        SELECT id, name
        FROM tournaments
        WHERE clan_id = $1 AND active = true
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [clanId]
      );

      if (tRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          '⚠️ Нет активного турнира. Сначала создайте его командой: +турнир',
          { reply_to_message_id: msg.message_id }
        );
      }

      const tournament = tRes.rows[0];

      // 2) Берём всех участников активного турнира
      const pRes = await db.query(
        `
          SELECT 
            tp.actor_id,
            cm.telegram_tag,
            cm.nickname
          FROM tournament_participants tp
          LEFT JOIN clan_members cm
            ON cm.actor_id = tp.actor_id
          WHERE tp.tournament_id = $1
        `,
        [tournament.id]
      );

      if (pRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          `⚠️ В активном турнире "${tournament.name}" нет участников.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      let sent = [];
      let failed = [];

      // 3) Рассылaем сообщения каждому игроку
      for (const u of pRes.rows) {
        // console.log(u);
        if (!u.telegram_tag) {
          failed.push(`• ${u.nickname || 'Без ника'} — нет telegram_tag`);
          continue;
        }

        const actorId = u.actor_id;
        console.log(actorId);

        try {
          await bot.sendMessage(
            actorId,
            `📢 *ЛОББИ ТУРНИРА*\n\n${escapeMarkdown(lobbyText)}`,
            { parse_mode: 'Markdown' }
          );
          sent.push(`• ${escapeMarkdown(u.nickname) || escapeMarkdown(u.telegram_tag)}`);
        } catch (e) {
          failed.push(`• ${escapeMarkdown(u.nickname) || escapeMarkdown(u.telegram_tag)} — не могу написать`);
        }
      }

      // 4) Ответ в админ-чат
      let report = [];
      report.push(`📨 Рассылка лобби для турнира *"${escapeMarkdown(tournament.name)}"* завершена.\n`);
      report.push('✅ Отправлено:');
      report.push(sent.length ? sent.join('\n') : '—');

      report.push('\n⚠️ Не удалось отправить:');
      report.push(failed.length ? failed.join('\n') : '—');

      await bot.sendMessage(chatId, report.join('\n'), {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });

    } catch (err) {
      console.error('ERROR in +лобби:', err);
      bot.sendMessage(
        chatId,
        '⚠️ Ошибка при рассылке лобби.',
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
