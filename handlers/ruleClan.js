const db = require('./db'); // подключение к PostgreSQL

const isAdminChat = require('../admin/permissionAdminChat');
const isAllowedChat = require('./../admin/permissionChats');
const getClanId = require('../clan/getClanId');

module.exports = function (bot) {
  // !+правила1 <текст>
  bot.onText(/^\+правила\s+([\s\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    const content = (match?.[1] || '').trim();
    if (!content) {
      return bot.sendMessage(chatId, '❌ Вы не указали текст правил.');
    }

    try {
      const clanId = Number(await getClanId(chatId));
      if (!Number.isInteger(clanId) || clanId <= 0) {
        return bot.sendMessage(chatId, '❌ Не удалось определить клан для этого чата.');
      }

      await db.query(
        `INSERT INTO public.rules (content, clan_id)
         VALUES ($1, $2)
         ON CONFLICT (clan_id) DO UPDATE
         SET content = EXCLUDED.content`,
        [content, clanId]
      );

      await bot.sendMessage(chatId, '✅ Правила сохранены или обновлены.', {
        reply_to_message_id: msg.message_id,
      });
    } catch (err) {
      console.error('Ошибка при сохранении правил:', err);
      await bot.sendMessage(chatId, '❌ Ошибка при сохранении правил.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });


  // правила
    bot.onText(/^\s*правила\s*$/i, async (msg) => {

    const chatId = msg.chat.id;
      
   // if (!isAllowedChat(chatId)) return
    const clanId = await getClanId(chatId);
    try {
      const result = await db.query(`SELECT content FROM rules WHERE clan_id = $1`,[clanId]);
      
      if (result.rowCount === 0) {
        return bot.sendMessage(chatId, 'ℹ️ Правила ещё не добавлены.',  {
                                reply_to_message_id: msg.message_id,
                              });
      }

      const rulesText = result.rows[0].content;
      bot.sendMessage(chatId, `📜 Правила:\n\n${rulesText}`,  {
                       reply_to_message_id: msg.message_id,
                     });
    } catch (err) {
      console.error('Ошибка при получении правил:', err);
      bot.sendMessage(chatId, '❌ Ошибка при получении правил.',  {
                       reply_to_message_id: msg.message_id,
                     });
    }
  });
};
