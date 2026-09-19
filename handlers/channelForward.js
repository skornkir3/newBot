module.exports = function (bot, FROM_CHANNEL_ID, TO_CHAT_ID, clan_id) {
  bot.on('channel_post', async (msg) => {
    try {
      const text = msg.text || msg.caption || ''; // текст поста или подпись к фото 
      const chatId1 = "-1002549710535";
      const chatId2 = "-1002833167359";
     
      if(FROM_CHANNEL_ID == "@chessmankirLive"){
        if (/#стрим/i.test(text)) {
            if (TO_CHAT_ID == chatId1 || TO_CHAT_ID == chatId2 ){
              const messageId = msg.message_id;
              try{
                await bot.forwardMessage(TO_CHAT_ID, FROM_CHANNEL_ID, messageId);
              }
              catch{

              }
            }
            return;
         }
      }
      // Проверяем наличие тега
      if(FROM_CHANNEL_ID == "@uDIMApubgm"){
        if (/#стрим/i.test(text)) {
          //  console.log(clan_id);
          if (TO_CHAT_ID == chatId1 || TO_CHAT_ID == chatId2 ){
            const messageId = msg.message_id;
            try{
              await bot.forwardMessage(TO_CHAT_ID, FROM_CHANNEL_ID, messageId);
            }
            catch{

            }
           }
          return;
          }
          else{
            const messageId = msg.message_id;
            try{
              await bot.forwardMessage(TO_CHAT_ID, FROM_CHANNEL_ID, messageId);
            }
            catch{

            }
          }
      }      
    } catch (error) {
      //console.log(TO_CHAT_ID);
      console.error('Ошибка при форварде сообщения:', error);
    }
  });
};