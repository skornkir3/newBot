// modules/cmd.description.js
// helper: реальный ли реплай человеку, а не шапке/боту/каналу
const getPlayerDescription = require('./../db/getDescriptionDb');
const getPartner = require('./../handlers/getMarriagePartner');
const isAllowedChat = require('./../admin/permissionChats');
const isAdminChat = require('./../admin/permissionAdminChat');
const { getUserStats } = require('../handlers/activityTracker');
const getClanId = require('../clan/getClanId');
const getBanReason = require('../db/getBanReason');
const { policyanalyzer } = require('googleapis/build/src/apis/policyanalyzer');

function escapeMarkdown(text) {
  if (!text) return '—';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

// ★ Форматирование времени (YYYY-MM-DD HH:MM)
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


// реальный ли реплай пользователю (а не шапке/боту/каналу)
function isRealUserReply(msg) {
  const r = msg.reply_to_message;
  if (!r) return false;
  console.log('1');
  if (!r.from || r.from.is_bot) return false;          // не бот
  
  if (r.is_topic_message && r.forum_topic_created){
    return false;
  } 
  
 // if (r.sender_chat) return false;                      // ответ на канал/чат
  
  /*if (typeof msg.message_thread_id === 'number' && r.message_id === msg.message_thread_id) {
    console.log('5');
    // многие клиенты ставят reply на «шапку» с id == thread_id
    return false;
  }*/
  return true;
}

module.exports = function (bot) {
  bot.onText(/^описание(?:\s+@(\S+))?$/iu, async (msg, match) => {
    console.log("description");
    const chatId = msg.chat.id;
    const isPrivate = msg.chat?.type === 'private';
    // if (!isAllowedChat(chatId)) return;
    try {
      const explicitTag = match[1] ? `@${match[1]}` : null;
      const author = msg.from;

      let actorId = null;            // ключ №1
      let requestedUsername = null;  // ключ №2 (если нет actorId)

      // 1) Явный @ всегда можно указать
      if (explicitTag) {
        requestedUsername = explicitTag;
      } else if (isRealUserReply(msg)) {
        // 2) Реальный реплай — берём id адресата
        actorId = msg.reply_to_message.from.id;
      } else {
        // 3) Реплая нет — берём автора команды
        actorId = author?.id ?? null;
      }
      if (!requestedUsername && !actorId) {
        return bot.sendMessage(
          chatId,
          '❗ У пользователя нет username. Укажи @username явно: `!описание @user`',
          { reply_to_message_id: msg.message_id, parse_mode: 'Markdown' }
        );
      }

      // Ключ поиска: приоритет actorId
      const key = actorId ? String(actorId) : requestedUsername;
      const player = await getPlayerDescription(key);
      const clanId = await getClanId(chatId);
      if(player.clanId != clanId ){
        if(isPrivate && !explicitTag ){
          // все ок
        }   
        else{
          return bot.sendMessage(
            chatId,
            `❌ Описание не найдено.`,
            { reply_to_message_id: msg.message_id }
          );  
        }
      }

      if (!player) {
        return bot.sendMessage(
          chatId,
          `❌ Описание для ${requestedUsername || `ID ${actorId}`} не найдено.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      const pubgId = player.pubgId != null ? String(player.pubgId) : '';
      // что показывать в заголовке (если искали по ID — показываем ID)
      const subjectForText = actorId ? `ID ${actorId}` : requestedUsername;
      console.log(player);
      
      let text = `
🧾 Описание игрока :

👤 Имя: ${escapeMarkdown(player.name)}
🏷 Ник: ${escapeMarkdown(player.nick)}
🎮 PUBG ID: \`${escapeMarkdown(pubgId) || '—'}\`
🎂 Возраст: ${escapeMarkdown(player.age.toString())}
📍 Город: ${escapeMarkdown(player.city)}
      `.trim();  
      if(player.note != null){
         text += `\n📒 ${escapeMarkdown(player.note)}`;
      }
      console.log(text);
    const partner = await getPartner(key);
      if(partner != null){
        
        if (partner && partner.partner_tag) {
          text += `\n❤️ Этот пользователь в отношениях с ${escapeMarkdown(partner.partner_tag)}`;
        }

      }
     if(await isAdminChat(chatId)){
        text += `\n🏰 Клан: ${player.clan}`;
        let lastMsgStr = '—';
          try {
            const stats = await getUserStats(chatId, player.tgId);
            lastMsgStr = formatWhen(stats.lastMsgAt);
          } catch (e) {
            console.error('getUserStats error:', e);
          }
        
        
        text += `\n🕒 Последнее сообщение: ${escapeMarkdown(lastMsgStr)}`;
        const reason = await getBanReason(player.tgId, clanId);
        text += `\n` + ( player.active ?  "✅ В клане." : "⛔ Забанен.");
       if (reason){
         text += `\n` + "⛔ " + reason;
       }    
     } 
      
      text = text.trim();
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: pubgId
            ? [[{ text: '📋 Скопировать PUBG ID', copy_text: { text: pubgId } }]]
            : []
        }
      });
    } catch (error) {
      console.error('ошибка', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка при получении описания.', {
        reply_to_message_id: msg.message_id
      });
    }
  });
};
