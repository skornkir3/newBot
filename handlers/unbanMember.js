const db = require('./db');
const isAllowedChat = require('../admin/permissionChats');
const getClanId = require('../clan/getClanId');
const getClanChats = require('../clan/getClanChat');
const isAdminChat = require('../admin/permissionAdminChat');

module.exports = function (bot) {
  bot.onText(/!разбан\s+@(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
    const tag = `@${match[1]}`.toLowerCase();
    const clanId = await getClanId(chatId);
    const chats = await getClanChats(clanId);
    
    try {
      // Ищем участника по @тегу
      const res = await db.query(
        'SELECT * FROM clan_members WHERE lower(telegram_tag) = $1 AND clan_id = $2',
        [tag, clanId]
      );

      if (res.rowCount === 0) {
        return bot.sendMessage(chatId, `❌ Участник ${tag} не найден.`);
      }

      const member = res.rows[0];
      // Обновляем в базе
      await db.query(
        'UPDATE clan_members SET active = TRUE WHERE lower(telegram_tag) = $1',
        [tag]
      );

      // Если есть actor_id — снимаем бан в чате

      if (member.actor_id) {
        for (const chat of chats) {
          try {
            console.log(chat);
            console.log(member.actor_id);
            await bot.unbanChatMember(chat, member.actor_id);      
            await new Promise(res => setTimeout(res, 400));
          } catch (err) {
            console.error(`❌ Ошибка при бане в чате:`, err.description || err.message);
          }
        }
      }
      await bot.sendMessage(chatId, `✅ ${tag} разбанен и активирован.`, {
          reply_to_message_id: msg.message_id,
        }
       );
    } catch (err) {
      console.error('Ошибка при разбане:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка при попытке разбана.', {
                        reply_to_message_id: msg.message_id,
                      }
                     );
    }
  });
};
