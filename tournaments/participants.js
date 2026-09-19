const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

function normDigits(s) {
  return (s || '').toString().replace(/\D+/g, '');
}
console.log('participants');
module.exports = function registerCastsCommand(bot) {
    bot.onText(/^\+каста([\s\S]*)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    console.log('casta');
  //  const isAdmin = await isAdminChat(chatId);
  //  if (!isAdmin) return;

    const clanId = await getClanId(chatId);
      if (clanId != 1){return;}
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    const tail = (match[1] || '').trim();
    const rawIds = tail.split(/[\n\r\s]+/).map(normDigits).filter(Boolean);
    if (rawIds.length === 0) {
      return bot.sendMessage(
        chatId,
        '⚠️ Укажите PUBG ID игроков после команды.\nПример:\n+касты\n123\n456\n789',
        { reply_to_message_id: msg.message_id }
      );
    }

    try {
      // 1. Ищем активный турнир
      const tRes = await db.query(
        `
          SELECT id, name, team_size
          FROM tournaments
          WHERE clan_id = $1 AND active = true
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [clanId]
      );

      if (tRes.rowCount === 0) {
        return;
        return bot.sendMessage(
          chatId,
          '⚠️ Нет активного турнира. Создайте его командой:\n+турнир 3 Касты #1',
          { reply_to_message_id: msg.message_id }
        );
      }

      const tournament = tRes.rows[0];
      const teamSize = tournament.team_size;

      const ids = rawIds.slice(0, teamSize);
      console.log(ids);
    /*  if (ids.length < teamSize) {
        return bot.sendMessage(
          chatId,
          `⚠️ Размер команды: ${teamSize}. Нужно указать минимум ${teamSize} игроков.`,
          { reply_to_message_id: msg.message_id }
        );
      } */

      // 2. Ищем игроков в clan_members
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const params = [...ids];

      const res = await db.query(
        `
          SELECT actor_id, pubg_id, nickname, telegram_tag
          FROM clan_members
          WHERE pubg_id IN (${placeholders}) 
        `,
        params
      );
      console.log(res.rows);
      console.log(ids.length);
      console.log(res.rowCount);
      if (res.rowCount !== ids.length) {
        const found = res.rows.map(r => String(r.pubg_id));
        const missing = ids.filter(id => !found.includes(id));
        return bot.sendMessage(
          chatId,
          '❌ Не найдены игроки:\n' + missing.map(x => `• ${x}`).join('\n'),
          { reply_to_message_id: msg.message_id }
        );
      }

      // 3. Получаем номер команды
    /*  const teamRes = await db.query(
        `
          SELECT COALESCE(MAX(team_no), 0) AS max_team
          FROM tournament_participants
          WHERE tournament_id = $1
        `,
        [tournament.id]
      );

      const nextTeamNo = (teamRes.rows[0].max_team || 1) + 1; */

      const teamRes = await db.query(
        `
          WITH used AS (
            SELECT DISTINCT team_no
            FROM tournament_participants
            WHERE tournament_id = $1
          ),
          mx AS (
            SELECT COALESCE(MAX(team_no), 1) AS m
            FROM used
          ),
          candidates AS (
            SELECT generate_series(2, (SELECT m FROM mx) + 1) AS n
          )
          SELECT n
          FROM candidates c
          LEFT JOIN used u ON u.team_no = c.n
          WHERE u.team_no IS NULL
          ORDER BY n
          LIMIT 1
        `,
        [tournament.id]
      );

      const nextTeamNo = teamRes.rows[0].n;


      // 4. Записываем участников
      const values = [];
      const insertParams = [];
      let n = 1;

      for (const row of res.rows) {
        values.push(`($${n++}, $${n++}, $${n++})`);
        insertParams.push(tournament.id, row.actor_id, nextTeamNo);
      }

      await db.query(
        `
          INSERT INTO tournament_participants (tournament_id, actor_id, team_no)
          VALUES ${values.join(', ')}
        `,
        insertParams
      );

      // Ответ
      let text = `✅ Команда со слотом №${nextTeamNo} добавлена в турнир "${tournament.name}"!\n\n`;

      for (const p of res.rows) {
        text += `• ${p.nickname || 'Без ника'} (${p.telegram_tag || '—'}) — ${p.pubg_id}\n`;
      }

      bot.sendMessage(chatId, text, { reply_to_message_id: msg.message_id });
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Ошибка при добавлении команды.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
