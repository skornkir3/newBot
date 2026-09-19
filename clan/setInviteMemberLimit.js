const isAdminChat = require('../admin/permissionAdminChat');
const getClanId   = require('../clan/getClanId');
const setLimitByNumber = require('../db/setLimitMemberDb'); // новая функция обновления по (clan_id, number)

module.exports = function (bot) {
  // Пример: +лимит 3 60
  bot.onText(/^\+лимит\s+(\d+)\s+(\d+)/iu, async (msg, m) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    const number = parseInt(m[1], 10);
    const limit  = parseInt(m[2], 10);

    if (isNaN(limit) || limit < 1) {
      return bot.sendMessage(chatId, '❌ Укажите корректное число для лимита.', {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      const clanId = await getClanId(chatId);
      if (!clanId) {
        return bot.sendMessage(
          chatId,
          '❌ Этот чат не привязан к клану. Сначала зарегистрируйте клан.',
          { reply_to_message_id: msg.message_id }
        );
      }

      const row = await setLimitByNumber(clanId, number, limit);

      const text =
        `✅ Лимит участников для клана №${row.number} обновлён.\n` +
        `Теперь лимит: ${row.member_limit} человек.`;

      await bot.sendMessage(chatId, text, {
        reply_to_message_id: msg.message_id,
      });

    } catch (err) {
      console.error(err);
      const t = /не найден/i.test(err.message)
        ? '❌ Клан с таким номером  не найден.'
        : '❌ Ошибка при обновлении лимита.';
      await bot.sendMessage(chatId, t, { reply_to_message_id: msg.message_id });
    }
  });

  // Подсказка
  bot.onText(/^\+лимит(?:\s+(\d+))?$/iu, async (msg) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
    bot.sendMessage(
      chatId,
      'ℹ️ Использование: +лимит <номер_клана> <число>\n' +
      'Пример: +лимит 3 60',
      { reply_to_message_id: msg.message_id }
    );
  });
};
