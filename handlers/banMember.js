const db = require('./db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');
const getClanChats = require('../clan/getClanChat');

module.exports = function (bot) {
  bot.onText(/^!бан\s+@(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 
    const username = `@${match[1]}`; // тег вида @user
    const full = (msg.text || '').trim();

    // ищем причину в том же сообщении (после @тега), поддерживает перенос строки
    const mReason = full.match(/^!бан\s+@\S+\s+([\s\S]+)$/iu);
    const reason = mReason ? mReason[1].trim() : null;
    const clanId = await getClanId(chatId);
    const chats = await getClanChats(clanId);
    try {
      // 1) находим запись в БД
      const res = await db.query(
        `SELECT actor_id FROM clan_members WHERE LOWER(telegram_tag) = LOWER($1) AND clan_id = $2 LIMIT 1`,
        [username, clanId]
      );

      if (res.rowCount === 0) {
        console.log(res.rows);
        return bot.sendMessage(chatId, `❌ Участник ${username} не найден в базе.`, {
          reply_to_message_id: msg.message_id,
        });
      }

      const { actor_id: actorId } = res.rows[0];

      // 2) помечаем неактивным в БД
      await db.query(
        `UPDATE clan_members SET active = FALSE WHERE LOWER(telegram_tag) = LOWER($1) AND clan_id = $2`,
        [username, clanId]
      );

      // 3) если есть actorId — баним в чате
      if (actorId) {
        for (const chat of chats) {
          try {
            await bot.banChatMember(chat, actorId);      
            await new Promise(res => setTimeout(res, 400));
          } catch (err) {
            
          }
        }
      }
     console.log(reason);
      if (reason) {
        const moderatorTag = msg.from?.username ? `@${msg.from.username}` : null;
        const moderatorId = msg.from?.id || null;
        await db.query(
          `INSERT INTO public.ban_reasons
             (clan_id, actor_id, telegram_tag, reason, moderator_tg_id, moderator_tag)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [clanId, actorId, username, reason, moderatorId, moderatorTag]
        );
      }

      await bot.sendMessage(
        chatId,
        actorId
          ? `🚫 ${username} забанен: в БД помечен неактивным, в чате заблокирован.`
          : `🚫 ${username} помечен неактивным. В чате не забанен (нет actor_id).`,
        { reply_to_message_id: msg.message_id }
      );

    } catch (err) {
      console.error('Ошибка при бане:', err);
      await bot.sendMessage(chatId, `❌ Ошибка при бане ${username}.`, {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
