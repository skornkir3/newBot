// modules/cmd.activity.js
const { error } = require('console');
const { getUserStats, getTopActive } = require('../handlers/activityTracker');
const getPlayerDescription = require('./../db/getDescriptionDb');

// простое экранирование для Markdown
function esc(s) {
  if (s === null || s === undefined) return '—';
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
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
  return `${day}.${m}.${y} ${hh}:${mm}`;
}


module.exports = function (bot) {
  // !активность — для себя / реплая / @username (если юзер есть в чате)
  bot.onText(/^!активность(?:\s+@?([\w\d_]+))?$/iu, async (msg, match) => {
    const chatId = msg.chat.id;

    // 1) Кого смотрим
    let userId = msg.from.id;
    
    let title = `Активность`;

    // если ответ на чужое сообщение — берём адресата
    

    if (match[1]) {
      // если указали @username — попробуем получить через getChatMember (сработает, если он есть/был в чате)
      try{
    //    const uname = match[1];
        const explicitTag = match[1] ? `@${match[1]}` : null;
        const player = await getPlayerDescription(explicitTag);
        if (player == null){ return;}
        userId = player.tgId;
      }
      catch(e){
        console.log('Ошибка активности', error);
        return;   
      }
    }

    // 2) Загружаем агрегаты
    const stats = await getUserStats(chatId, userId);

    const text = [
      `*${esc(title)}*`,
      `Последнее сообщение: ${esc(formatWhen(stats.lastMsgAt))}`,
      `За 7 дней: *${stats.week}*`,
      `За 30 дней: *${stats.month}*`,
      `За всё время: *${stats.total}*`,
    ].join('\n');

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
  });

  // !топ7 — топ активных за 7 дней (можно !топ30)
  bot.onText(/^!топ(\d+)?$/iu, async (msg, match) => {
    const chatId = msg.chat.id;
    const days = Math.max(1, Math.min(90, Number(match[1] || 7))); // 1..90
    const rows = await getTopActive(chatId, days, 10);
    if (!rows.length) {
      return bot.sendMessage(chatId, `За последние ${days} дн. нет данных.`, { reply_to_message_id: msg.message_id });
    }

    // попробуем подтянуть имена через getChatMember (если доступны)
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let label = `ID ${r.user_id}`;
      try {
        const m = await bot.getChatMember(chatId, r.user_id);
        const u = m.user;
        label = u.username ? `@${u.username}` : `${u.first_name || ''} ${u.last_name || ''}`.trim() || label;
      } catch (_) {}
      lines.push(`${i+1}. ${label} — ${r.count}`);
    }

    await bot.sendMessage(chatId, `Топ за ${days} дн.:\n` + lines.join('\n'), {
      reply_to_message_id: msg.message_id
    });
  });
};
