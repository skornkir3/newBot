// modules/cmd.subclan.js
const createSubclan = require('../clan/createSubClanDb');
const getPlayerDescription = require('./../db/getDescriptionDb');
const getClanId = require('../clan/getClanId');
const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');

module.exports = function (bot) {
  // +подклан <leaderTag> [limit] [inviteLink?]
  bot.onText(/^\+подклан\s+(\S+)(?:\s+(\d+))?(?:\s+(https?:\/\/\S+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    console.log('match:', match);

    try {
      // получаем id клана
      const clanId = await getClanId(chatId);
      if (!clanId) {
        return bot.sendMessage(chatId, '⚠️ ошибка создания.');
      }
      const isADminChatPermisson = await isAdminChat(chatId);
      if (!isADminChatPermisson){
        return;
      } 
      
      // тег лидера
      const leaderTag = match[1];
      if (!leaderTag) {
        return bot.sendMessage(chatId, '⚠️ Укажите тэг лидера, пример: +подклан @nickname');
      }
      console.log(leaderTag);
      // пробуем найти лидера в базе
      const player = await getPlayerDescription(leaderTag);
      console.log(player);

      if(!player || player.clanId != clanId){
        return bot.sendMessage(
          chatId,
          `❌ Указанный игрок не в клане.`,
          { reply_to_message_id: msg.message_id }
        );
      }
      
      const leaderActorId = player.tgId;

      // лимит — если не указан, по умолчанию 60
      const memberLimit = match[2] ? parseInt(match[2], 10) : 60;

      // необязательная ссылка
     // const inviteLink = match[3] || null;

      const clanRes = await db.query(
        `SELECT id, invite_link
           FROM public.clans
          WHERE id = $1
          LIMIT 1`,
        [clanId]
      );
      if (clanRes.rowCount === 0) throw new Error('Клан с таким id не найден');

      const inviteLink = clanRes.rows[0].invite_link; // может быть null

      // создаём подклан
      
      const sub = await createSubclan(clanId, leaderActorId, memberLimit, inviteLink);
      
      await bot.sendMessage(
        chatId,
        [
          '✅ Подклан успешно создан:',
          `👑 Лидер: ${player.name || leaderTag}`,
          `👥 Лимит: ${sub.member_limit}`,
   //       `🔗 Ссылка: ${sub.invite_link || 'взята из основного клана или отсутствует'}`
        ].join('\n')
      );
    } catch (err) {
      console.error('Ошибка при создании подклана:', err);
      await bot.sendMessage(chatId, `❌ ${err.message}`);
    }
  });
};
