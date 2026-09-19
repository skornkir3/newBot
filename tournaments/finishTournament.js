const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

module.exports = function registerFinishTournament(bot) {
  bot.onText(/^!завершить\s+турнир$/iu, async (msg) => {
    const chatId = msg.chat.id;

    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // Находим активный турнир
      const cur = await db.query(
        `
        SELECT id, name, created_at
        FROM tournaments
        WHERE clan_id = $1 AND active = true
        ORDER BY id DESC
        LIMIT 1
        `,
        [clanId]
      );

      if (cur.rowCount === 0) {
        return bot.sendMessage(chatId, '⚠️ Активный турнир не найден.', {
          reply_to_message_id: msg.message_id,
        });
      }

      const t = cur.rows[0];

      // Завершаем
      await db.query(
        `
        UPDATE tournaments
        SET active = false
        WHERE id = $1 AND clan_id = $2
        `,
        [t.id, clanId]
      );

      const dt = new Date(t.created_at).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      return bot.sendMessage(
        chatId,
        `✅ Турнир завершён!\n\n` +
          `ID: ${t.id}\n` +
          `Название: ${t.name}\n` +
          `Дата: ${dt}\n` +
          `Статус: ⚫ Неактивный`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, '⚠️ Ошибка при завершении турнира.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
