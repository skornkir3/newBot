const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

module.exports = function registerCreateTournament(bot) {
  bot.onText(/^\+турнир\s+(\d+)\s+(.+)$/iu, async (msg, match) => {
    const chatId = msg.chat.id;

    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    const teamSize = parseInt(match[1], 10);
    const name = (match[2] || '').trim();

    if (!teamSize || teamSize <= 0) {
      return bot.sendMessage(
        chatId,
        '⚠️ Размер команды неверный. Пример: +турнир 3 Касты',
        { reply_to_message_id: msg.message_id }
      );
    }

    try {
      await db.query('BEGIN');

      // 1. Делаем все старые турниры неактивными
      await db.query(
        `
          UPDATE tournaments
          SET active = false
          WHERE clan_id = $1
        `,
        [clanId]
      );

      // 2. Создаём новый турнир
      const res = await db.query(
        `
          INSERT INTO tournaments (clan_id, name, team_size, active)
          VALUES ($1, $2, $3, true)
          RETURNING id, created_at
        `,
        [clanId, name, teamSize]
      );

      await db.query('COMMIT');

      const t = res.rows[0];

      bot.sendMessage(
        chatId,
        `✅ Турнир создан!\n\n` +
          `ID: ${t.id}\n` +
          `Название: ${name}\n` +
          `Размер команды: ${teamSize}\n` +
          `Дата: ${new Date(t.created_at).toLocaleString('ru-RU')}\n` +
          `Статус: 🔵 Активный`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Ошибка при создании турнира.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
