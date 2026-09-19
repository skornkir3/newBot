const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

module.exports = function registerParticipantsListCommand(bot) {
  // Показывает участников активного турнира
  bot.onText(/^!участники$/i, async (msg) => {
    const chatId = msg.chat.id;
    console.log('!участники');

    // const isAdmin = await isAdminChat(chatId);
   // if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // 1) Берём активный турнир для этого клана
      const tRes = await db.query(
        `
          SELECT id, name, team_size, created_at
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
          '⚠️ У этого клана нет активного турнира. Создайте его через: +турнир …',
          { reply_to_message_id: msg.message_id }
        );
      }

      const tournament = tRes.rows[0];

      // 2) Берём участников этого турнира
      const pRes = await db.query(
        `
          SELECT
            tp.team_no,
            cm.nickname,
            cm.telegram_tag,
            cm.pubg_id
          FROM tournament_participants tp
          JOIN clan_members cm
            ON cm.actor_id = tp.actor_id
          WHERE tp.tournament_id = $1
          ORDER BY tp.team_no, cm.nickname NULLS LAST
        `,
        [tournament.id]
      );

      if (pRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          `В активном турнире "${tournament.name}" (ID: ${tournament.id}) пока нет ни одной команды.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      // 3) Группируем по командам
      const teams = new Map();
      for (const row of pRes.rows) {
        if (!teams.has(row.team_no)) {
          teams.set(row.team_no, []);
        }
        teams.get(row.team_no).push(row);
      }

      // 4) Собираем текст
      const lines = [];

      lines.push(
        `Турнир: ${tournament.name}`,
        `Размер команды: ${tournament.team_size}`,
        `Дата проведения: ${new Date(tournament.created_at).toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        `Статус: 🔵 активный`,
        `Участников: ` + pRes.rowCount,
        ''
      );

      const sortedTeams = [...teams.entries()].sort((a, b) => a[0] - b[0]);

      for (const [teamNo, members] of sortedTeams) {
        lines.push(`🧩 Команда ${teamNo}`);
        for (const m of members) {
          const nick = m.nickname || 'Без ника';
          const tag = m.telegram_tag || '—';
          lines.push(`• ${nick} (${tag}) — ${m.pubg_id}`);
        }
        lines.push(''); // пустая строка между командами
      }

      await bot.sendMessage(chatId, lines.join('\n'), {
        reply_to_message_id: msg.message_id,
      });
    } catch (err) {
      console.error('ERROR in !участники:', err);
      bot.sendMessage(
        chatId,
        '⚠️ Ошибка при получении списка участников.',
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
