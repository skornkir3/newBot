const db = require('../handlers/db'); // путь к подключению к базе
const isAllowedChat = require('../admin/permissionChats');
const isAdminChat = require('../admin/permissionAdminChat');
const { getUserStats } = require('../handlers/activityTracker');
const getClanId = require('../clan/getClanId');
const getBanReason = require('../db/getBanReason');

function escapeMarkdown(text) {
  if (!text) return '—';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

function formatWhen(ts) {
  if (!ts) return '—';
  const d = new Date(ts);

  // прибавляем 3 часа
  d.setHours(d.getHours() + 3);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${m}-${y} ${hh}:${mm}`;
}

module.exports = function (bot) {
  bot.onText(/!поиск\s+(.+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    const query = match[1].trim().toLowerCase();
    const clanId = await getClanId(chatId);
    try {
      const res = await db.query(
        `SELECT * FROM clan_members 
         WHERE LOWER(telegram_tag) = $1 and clan_id = $2
         OR CAST(pubg_id AS TEXT) = $1 
         OR LOWER(nickname) = $1
         LIMIT 1`,
        [query, clanId]
      );

      if (res.rows.length === 0) {
        return bot.sendMessage(chatId, `❌ Участник по запросу "${query}" не найден.`, {
          reply_to_message_id: msg.message_id
        });
      }

      const user = res.rows[0];
      let message = `
📄 Найден участник: ${user.telegram_tag || '(нет тега)'}

👤 Имя: ${user.name || '(нет имени)'}
🧾 Ник: ${user.nickname || '(нет ника)'}
🆔 PUBG ID: ${user.pubg_id || '(нет PUBG ID)'}
📅 Возраст: ${user.age || '(не указан)'}
📍 Город: ${user.city || '(не указан)'}
🏰 Клан: ${user.clan || '(не указан)'}
      `.trim();

      let lastMsgStr = '—';
      try {
        const stats = await getUserStats(chatId, user.actor_id);
        lastMsgStr = formatWhen(stats.lastMsgAt);
      } catch (e) {
        console.error('getUserStats error:', e);
      } 
      message += `\n🕒 Последнее сообщение: ${escapeMarkdown(lastMsgStr)}`;
      message += '\n' + (user.active ? "✅ В клане." : "⛔ Забанен.");
      
      if (!user.active){
        const reason = await getBanReason(user.actor_id, clanId);
        if (reason){
          message += `\n` + "⛔ " + reason;
        }
     }    
      bot.sendMessage(chatId, message, {
        reply_to_message_id: msg.message_id
      });

    } catch (err) {
      console.error('❌ Ошибка при поиске в базе:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка при поиске участника.', {
        reply_to_message_id: msg.message_id
      });
    }
  });
};

