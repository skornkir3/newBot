// commands/info.js
const isAdminChat = require('../admin/permissionAdminChat');

module.exports = function (bot) {
  bot.onText(/^!инфо\s+(\d{3,})$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
   // if (typeof isAllowedChat === 'function' && !isAllowedChat(chatId)) return;

    const tgId = Number(match[1]); // tgId из команды

    try {
      // 1. Получаем данные из Telegram API
      const chat = await bot.getChat(tgId);
      const photos = await bot.getUserProfilePhotos(tgId, { limit: 1 });

      let chatMember = null;
      try {
        chatMember = await bot.getChatMember(chatId, tgId);
        console.log(chatMember);
      } catch (_) {
        // если бот не может получить статус — игнорируем
      }

      // 2. Формируем ответ
      const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || '—';
      const response = `
<b>Информация о пользователе</b>

🆔 <b>TG ID:</b> ${tgId}
👤 <b>Имя:</b> ${fullName}
🔎 <b>Username:</b> ${chat.username ? '@' + chat.username : '—'}
📄 <b>Bio:</b> ${chat.bio || '—'}
🖼️ <b>Фото профиля:</b> ${photos.total_count}

${chatMember ? `👥 <b>Статус в чате:</b> ${chatMember.status}` : ''}
      `.trim();

      bot.sendMessage(chatId, response, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      });

    } catch (error) {
      console.error('Ошибка при получении инфо из Telegram:', error);
      bot.sendMessage(chatId, '❌ Не удалось получить информацию. Возможно, пользователь не писал боту.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
