const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');
const getClanLimits = require('../clan/getClanLimits');

function normalizeLimits(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const obj = {};
    for (const r of raw) {
      // поддержка разных имен полей
      const key = Number(r.number ?? r.clan ?? r.subclan ?? r.id);
      const val = Number(r.member_limit ?? r.limit ?? r.value);
      if (Number.isFinite(key) && Number.isFinite(val)) obj[key] = val;
    }
    return obj;
  }
  return raw; // уже объект { [number]: limit }
}

module.exports = function (bot) {
  bot.onText(/^!места$/iu, async (msg) => {
    const chatId = msg.chat.id;
    const isADminChatPermisson = await isAdminChat(chatId);
    if (!isADminChatPermisson){
      return;
    } 

    try {
      // 1) Определяем clan_id
      const clanId = await getClanId(chatId);
      if (!clanId) {
        return bot.sendMessage(chatId, '❗ Для этого чата не найден clan_id.', {
          reply_to_message_id: msg.message_id
        });
      }

      // 2) Берём лимиты по ЭТОМУ clan_id (важно: передаём clanId!)
      const rawLimits = await getClanLimits(clanId);
      const clanLimits = normalizeLimits(rawLimits);

      if (!clanLimits || Object.keys(clanLimits).length === 0) {
        return bot.sendMessage(chatId, '❗ Для клана не заданы лимиты подкланов.', {
          reply_to_message_id: msg.message_id
        });
      }

      // 3) Считаем активных по каждому внутреннему клану
      const res = await db.query(
        `SELECT clan, COUNT(*)::int AS count
           FROM public.clan_members
          WHERE active = TRUE
            AND clan_id = $1
          GROUP BY clan`,
        [clanId]
      );

      // 4) В словарь { [номер]: активных }
      const counts = {};
      for (const row of res.rows) counts[row.clan] = row.count;

      // 5) Формируем строки
      const clanNumbers = Object.keys(clanLimits)
        .map(n => Number(n))
        .sort((a, b) => a - b);

      const lines = clanNumbers.map(num => {
        const active = counts[num] || 0;
        const limit = clanLimits[num] || 0;
        return `♟ Клан ${num}: ${active}/${limit}`;
      });

      // 6) Итоги
      const used = clanNumbers.reduce((s, n) => s + (counts[n] || 0), 0);
      const allTotal = clanNumbers.reduce((s, n) => s + (clanLimits[n] || 0), 0);
      const free = allTotal - used;

      lines.push(`🪑 Свободно: ${free}`);
      lines.push(`👥 Всего: ${used}`);

      await bot.sendMessage(chatId, lines.join('\n'), {
        reply_to_message_id: msg.message_id
      });

    } catch (err) {
      console.error('Ошибка в !места:', err);
      await bot.sendMessage(chatId, '❌ Не удалось получить места по кланам.', {
        reply_to_message_id: msg.message_id
      });
    }
  });
};
