        // handlers/memberEventsHandler.js
const getPlayerDescription = require('./../db/getDescriptionDb');
const getClan = require('../clan/getClan');

module.exports = function(bot, notifyChatId, threadMessageId) {
          // Отладочный обработчик для всех сообщений
          bot.on('message', (msg) => {
            if (msg.left_chat_member || msg.new_chat_members) {
            //  console.log('Получено событие с участниками:', JSON.stringify(msg, null, 2));
            }
          });
          // ✅ Новый участник
          bot.on('new_chat_members', async (msg) => {
  const chatTitle = msg.chat.title || 'Без названия';

  await Promise.all(
    msg.new_chat_members.map(async (user) => {
      const tag = user.username ? `@${user.username}` : null;
      const name = tag || `${user.first_name} ${user.last_name || ''}`.trim();
      const player = tag ? await getPlayerDescription(tag) : null;  
      const message =
        `✅ Вступил в группу "${chatTitle}": ${name}` +
        (player ? `\nНик: ${player.nick}\nКлан: ${player.clan}` : '');

      /*return bot.sendMessage(notifyChatId, message, {
        reply_to_message_id: threadMessageId
      }); */

      try {
        const clanId = player.clanId;
        const clan = await getClan(clanId);
        if (player.clanId == 1 ){
          await bot.sendMessage(notifyChatId, message, {
            reply_to_message_id: threadMessageId, // если он валидный
          //  allow_sending_without_reply: true
          });
        }
        else{
          await bot.sendMessage(clan.admin_chat_id, message);
        }
        
      } catch (err) {
      //  console.error('⚠️ Ошибка при отправке сообщения в notifyChatId:', err.description || err.message);
      }

    })
  );
});

          // 📌 Участник вышел или был кикнут
  bot.on('chat_member', async (msg) => {   // ← добавил async
    try {
      console.log('chat member');
      const chatTitle = msg.chat.title || 'Без названия';
      const oldStatus = msg.old_chat_member.status;
      const newStatus = msg.new_chat_member.status;

      // Был участником → стал "left" или "kicked"
      const wasMember = ['member', 'restricted'].includes(oldStatus);
      const nowLeft = ['left', 'kicked'].includes(newStatus);

      if (!wasMember || !nowLeft) return;

      const user = msg.new_chat_member.user;
     
      const name = user.username
        ? `@${user.username}`
        : `${user.first_name} ${user.last_name || ''}`.trim();

      // если username есть — используем как tag
      const tag = user.username ? `@${user.username}` : null;
     console.log(tag);
      // getPlayerDescription async → можно вызывать await
      const player = tag ? await getPlayerDescription(tag) : null;
      console.log(player);

      const message =
        `🚪 Вышел из группы "${chatTitle}": ${name}` +
        (player ? `\nНик: ${player.nick}\nКлан: ${player.clan}` : '');

      try {
        await bot.sendMessage(notifyChatId, message, {
          reply_to_message_id: threadMessageId, // если он валидный
         // allow_sending_without_reply: true
        });
      } catch (err) {
       // console.error('⚠️ Ошибка при отправке сообщения в notifyChatId:', err.description || err.message);
      }


    } catch (error) {
      console.error('Ошибка обработки chat_member:', error);
    }
  });


};
