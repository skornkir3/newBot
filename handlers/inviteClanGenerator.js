// modules/cmd.inviteClan.js
const isAdminChat    = require('../admin/permissionAdminChat');
const getClanId      = require('../clan/getClanId');
const createClanInviteDb = require('../db/createClanInviteDB');

const escapeMdV2 = (s='') => s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');

// ====== Генератор кода инвайта ======
function makeInviteCode(prefix = 'CHECKMATE') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // исключаем 0,O,I,1
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${s.slice(0, 2)}${s.slice(2, 4)}${s.slice(4, 6)}`;
}
// ===================================

module.exports = function (bot) {
  bot.onText(/^!инвайтклана$/iu, async (msg) => {
    const chatId = msg.chat.id;
    if (!await isAdminChat(chatId)) return;

    try {
      const clanId = await getClanId(chatId);
      if (!clanId) {
        return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану. Сначала зарегистрируйте клан.', {
          reply_to_message_id: msg.message_id,
        });
      }

      let code = makeInviteCode('CHECKMATE');
      console.log(code);
      let invite;
      try {
        invite = await createClanInviteDb({ clanId, code });
      } catch (err) {
        if (err.retryable) {
          code = makeInviteCode('CHECKMATE');
          invite = await createClanInviteDb({ clanId, code });
        } else {
          throw err;
        }
      }

      const text = [
        '✅ *Инвайт клана создан*',
      ].join('\n');

      bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      });
  
      bot.sendMessage(chatId, code, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      });
    } catch (err) {
      console.error('Ошибка !инвайт клана:', err);
      bot.sendMessage(chatId, '❌ Ошибка при создании инвайта клана.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
