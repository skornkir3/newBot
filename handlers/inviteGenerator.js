const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const isAllowedChat = require('../admin/permissionChats');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

function generateCode() {
  return 'CLAN-' + Math.floor(100000 + Math.random() * 900000);
}

module.exports = function(bot) {
  bot.onText(/!инвайт(\d+)/, async (msg, match) => {
    console.log("invite");
    const clanNumber = parseInt(match[1]);
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    if (isNaN(clanNumber)) {
      return bot.sendMessage(msg.chat.id, '❗ Укажи номер клана: !инвайт1, !инвайт2 и т.д.', {
        reply_to_message_id: msg.message_id,
      });
    }

    const inviteCode = generateCode();
    const clanId = await getClanId(chatId);

    try {
      await db.query(
        'INSERT INTO invites (id, invite_code, is_active, clan_name, clan_id) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), inviteCode, true, clanNumber, clanId]
      );

      bot.sendMessage(msg.chat.id, `🎟️ Инвайт-код для клана №${clanNumber}:`, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      });
      
      bot.sendMessage(msg.chat.id, `<code>${inviteCode}</code>`, {
      parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      });

    } catch (err) {
      console.error('Ошибка при сохранении инвайта:', err.message);
      bot.sendMessage(msg.chat.id, '❗ Ошибка при создании инвайта.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
