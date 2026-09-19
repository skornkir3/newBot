// modules/cmd.setSubclanInviteByNumber.js
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId   = require('../clan/getClanId');
const setByNumber = require('../db/setInvtiteLinkDb'); // обновление по (clan_id, number)

// Без parse_mode. Ссылка дублируется и текстом, и кнопкой.
module.exports =  function (bot) {
  bot.onText(/^\+ссылка\s+(\d+)\s+(\S+)/iu, async (msg, m) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    const number = parseInt(m[1], 10);
    const link   = (m[2] || '').trim();

    try {
      const clanId = await getClanId(chatId);
      if (!clanId) {
        return bot.sendMessage(
          chatId,
          '❌ Этот чат не привязан к клану. Сначала зарегистрируйте клан.',
          { reply_to_message_id: msg.message_id }
        );
      }

      const row = await setByNumber(clanId, number, link);

      const text =
        `✅ Ссылка для клана №${row.number} обновлена.\n` +
        `Ссылка: ${row.invite_link}`;

      // пробуем без parse_mode + добавляем кнопку с URL
      try {
        await bot.sendMessage(chatId, text, {
          reply_to_message_id: msg.message_id,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть ссылку', url: row.invite_link }]]
          }
        });
      } catch (e) {
        // на всякий пожарный — второй заход вообще без опций
        console.error('sendMessage failed, retrying plain:', e?.message);
        await bot.sendMessage(chatId, text);
      }
    } catch (err) {
      console.error(err);
      const t = /не найден/i.test(err.message)
        ? '❌ Подклан с таким номером в вашем клане не найден.'
        : '❌ Ошибка при обновлении ссылки.';
      await bot.sendMessage(chatId, t, { reply_to_message_id: msg.message_id });
    }
  });

  // Подсказка
  bot.onText(/^\+ссылка(?:\s+(\d+))?$/iu, async (msg) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
    bot.sendMessage(
      chatId,
      'ℹ️ Использование: +ссылка <номер_подклана> <inviteLink>\n' +
      'Пример: +ссылка 3 https://t.me/+abc123XYZ',
      { reply_to_message_id: msg.message_id }
    );
  });
};
