const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

module.exports = function registerRemoveCastCommand(bot) {
  // -каста  (берём отправителя)
  bot.onText(/^-каста$/i, async (msg) => {
    const chatId = msg.chat.id;
    console.log('-каста by sender');

    // Проверяем: админский ли чат
   // const isAdmin = await isAdminChat(chatId);
    // if (!isAdmin) return;

    // Получаем клан
    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    // Берём username игрока — самого отправителя
    const username = msg.from.username ? msg.from.username.trim() : null;
    if (!username) {
      return bot.sendMessage(
        chatId,
        '⚠️ У отправителя нет @username — невозможно найти его в базе.',
        { reply_to_message_id: msg.message_id }
      );
    }

    const telegramTag = '@' + username;
    const senderId  = msg.from.id;

    try {
      // 1) Находим игрока в clan_members
      const memberRes = await db.query(
        `
          SELECT actor_id, nickname, telegram_tag, pubg_id
          FROM clan_members
          WHERE clan_id = $1
            AND actor_id = $2
          LIMIT 1
        `,
        [clanId, senderId]
      ); 
      if (memberRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          `⚠️ Игрок ${telegramTag} не найден в списке клана.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      const member = memberRes.rows[0];
      const actorId = member.actor_id;

      // 2) Ищем активный турнир
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
          '⚠️ У этого клана нет активного турнира.',
          { reply_to_message_id: msg.message_id }
        );
      }

      const tournament = tRes.rows[0];

      // 3) Находим команду игрока (team_no)
      const teamRes = await db.query(
        `
          SELECT team_no
          FROM tournament_participants
          WHERE tournament_id = $1
            AND actor_id = $2
          LIMIT 1
        `,
        [tournament.id, actorId]
      );

      if (teamRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          `⚠️ Игрок ${member.nickname || telegramTag} не состоит ни в одной команде активного турнира "${tournament.name}".`,
          { reply_to_message_id: msg.message_id }
        );
      }

      const teamNo = teamRes.rows[0].team_no;

      // 4) Получаем полный список игроков команды
      const membersRes = await db.query(
        `
          SELECT tp.actor_id, cm.nickname, cm.telegram_tag, cm.pubg_id
          FROM tournament_participants tp
          LEFT JOIN clan_members cm
            ON cm.actor_id = tp.actor_id
          WHERE tp.tournament_id = $1
            AND tp.team_no = $2
          ORDER BY cm.nickname NULLS LAST
        `,
        [tournament.id, teamNo]
      );
      // 5) Удаляем команду
      await db.query(
        `
          DELETE FROM tournament_participants
          WHERE tournament_id = $1 AND team_no = $2
        `,
        [tournament.id, teamNo]
      );

      // 6) Формируем ответ
      const lines = [];
      lines.push(
        `🗑 Команда №${teamNo} удалена из турнира "${tournament.name}".`,
        '',
        'Удалённые игроки:'
      );

      for (const m of membersRes.rows) {
        const nick = m.nickname || 'Без ника';
        const tag  = m.telegram_tag || '—';
        const pubg = m.pubg_id || '—';
        lines.push(`• ${nick} (${tag}) — PUBG ID: ${pubg}`);
      }

      await bot.sendMessage(chatId, lines.join('\n'), {
        reply_to_message_id: msg.message_id,
      });

    } catch (err) {
      console.error('ERROR in -каста:', err);
      bot.sendMessage(
        chatId,
        '⚠️ Ошибка при удалении команды.',
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
