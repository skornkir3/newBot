const handleChannelForward = require("../handlers/channelForward");

module.exports = async function (bot) {
   const nameTgk = "@chessmankirLive";
  //  const nameTgk = "@prikolforward";
    const chatId1 = "-1002549710535";
    const chatId2 = "-1002833167359";
    try {
      await handleChannelForward(bot, nameTgk, chatId1, 1);
    } catch (err) {
      console.error(`⚠️ Ошибка при репосте в ${chat.chat_id}:`, err.message);
    }
  try {
    await handleChannelForward(bot, nameTgk, chatId2, 1);
  } catch (err) {
    console.error(`⚠️ Ошибка при репосте в ${chat.chat_id}:`, err.message);
  }
    
  
};