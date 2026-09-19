const saveDescription = require('./saveDescriptionFunc');
const isAdminChat = require('./../admin/permissionAdminChat');
const saveMemberDb = require('./saveMemberDb');

const admins = [
  '@nurka7',
  '@chessmankir',
  '@wimepubgm'
];

// 📬 Обработчик команды "+описание1 @ник"
module.exports = function (bot) {
  bot.onText(/^\+описание1\s+@(\S+)\n(.+)/s, async (msg, match) => {
    return;
    const chatId = msg.chat.id;
    console.log('chat');
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
    const from = msg.from;
    const target_username = `@${match[1]}`;
    const lines = match[2].trim().split('\n');
    console.log('description');
    if (lines.length < 6) {
      return bot.sendMessage(chatId, '❌ Не хватает данных. Нужно 6 строк после ника.', {
        reply_to_message_id: msg.message_id,
      });
    }
    
    const data = {
      name: lines[0],  
      nick: lines[1],
      pubg_id: lines[2],
      target_username,  
      age: lines[3],
      city: lines[4],
      clan: lines[5],
      actor_id: null,
      date: 0,
    };
    console.log(data);
    await saveMemberDb(data);
    await saveDescription(data);

    bot.sendMessage(chatId, `✅ Описание для ${target_username} сохранено.`, {
      reply_to_message_id: msg.message_id,
    });
  });
};
