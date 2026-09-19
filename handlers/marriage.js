const pool = require('../handlers/db'); // 

module.exports = function marryCommand(bot) {
  bot.onText(/^!женить\s+@(\S+)\s+@(\S+)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const initiator = msg.from.id;
    const tag1 = match[1];
    const tag2 = match[2];
      console.log(tag1);
    console.log(tag2);
    if (tag1.toLowerCase() === tag2.toLowerCase()) {
      return bot.sendMessage(chatId, "❌ Нельзя женить человека сам на себе.");
    }
    console.log('@' + tag1.toLowerCase());
    try {
      // 1) Находим участников по telegram_tag
      const res = await pool.query(
        `SELECT actor_id, telegram_tag, nickname
         FROM clan_members
         WHERE LOWER(telegram_tag) IN ($1, $2) AND active = TRUE`,
        ['@' + tag1.toLowerCase(), '@' + tag2.toLowerCase()]
      );
      console.log(res.rows);

      if (res.rows.length < 2) {
        return bot.sendMessage(chatId, "❌ Не нашёл одного или обоих участников.");
      }

      const userA = res.rows.find(r => r.telegram_tag.toLowerCase() === '@' + tag1.toLowerCase());
      const userB = res.rows.find(r => r.telegram_tag.toLowerCase() === '@' + tag2.toLowerCase());
      console.log(userA);
      if (!userA?.actor_id || !userB?.actor_id) {
        return bot.sendMessage(chatId, "❌ У одного из пользователей нет actor_id. Пусть напишет сообщение в чат или свяжи вручную.",  {
                                 reply_to_message_id: msg.message_id
                               }   );
      }

      // 2) Проверяем активные браки
      const activeCheck = await pool.query(
        `SELECT 1 FROM marriages 
         WHERE chat_id = $1 
           AND ended_at IS NULL 
           AND (partner_a_id = $2 OR partner_b_id = $2 OR partner_a_id = $3 OR partner_b_id = $3)
         LIMIT 1`,
        [chatId, userA.actor_id, userB.actor_id]
      );

      if (activeCheck.rowCount > 0) {
        return bot.sendMessage(chatId, "❌ Один из участников уже состоит в браке.",  {
                                 reply_to_message_id: msg.message_id
                               }
                              );
      }
      console.log('create');
      // 3) Создаём брак
      await pool.query(
        `INSERT INTO marriages (chat_id, partner_a_id, partner_b_id, created_by)
         VALUES ($1,$2,$3,$4)`,
        [chatId, userA.actor_id, userB.actor_id, initiator]
      );

      const nameA = userA.nickname || userA.telegram_tag;
      const nameB = userB.nickname || userB.telegram_tag;

      await bot.sendMessage(chatId, `💍 Поздравляем! ${nameA} и ${nameB} теперь женаты 🎉`,  {
                              reply_to_message_id: msg.message_id
                            }
                           );
    } catch (e) {
      console.error("!женить error:", e);
      bot.sendMessage(chatId, "⚠️ Ошибка при регистрации брака.");
    }
  });
};
