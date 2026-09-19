// modules/cmd.nicknames.js
const db = require('./db');
const isAllowedChat = require('../admin/permissionChats');

const clanLimits = { 1: 55, 2: 60, 3: 60, 4: 40 };

// ID чатов
const CHAT_12 = -1002549710535; // показывать кланы 1 и 2
// const CHAT_12 = -1002986813514;
const CHAT_34 = -1002833167359; // показывать кланы 3 и 4


function escapeHtml(s) {
  if (!s) return '—';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// безопасная отправка длинного текста (разбивка на части)
async function sendInChunks(bot, chatId, text, options = {}) {
  const MAX = 4096; // лимит Telegram
  for (let i = 0; i < text.length; i += MAX) {
    const chunk = text.slice(i, i + MAX);
    await bot.sendMessage(chatId, chunk, options);
    // reply_to_message_id лучше указывать только для первого сообщения
    if (options.reply_to_message_id) options.reply_to_message_id = undefined;
  }
}

module.exports = function (bot) {
  bot.onText(/^!ники$/iu, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowedChat(chatId)) return;

    // Определяем какие кланы показывать
    let clansToShow;
    if (chatId === CHAT_12) {
      clansToShow = [1, 2];
    } else if (chatId === CHAT_34) {
      clansToShow = [3, 4];
    } else {
      return bot.sendMessage(
        chatId,
        '❗ Команда доступна только в закреплённых чатах кланов.'
      );
    }

    try {
      const { rows } = await db.query(
        `SELECT clan, telegram_tag, nickname
         FROM clan_members
         WHERE active = TRUE AND clan = ANY($1::int[])
         ORDER BY clan`,
        [clansToShow]
      );

      if (!rows || rows.length === 0) {
        return bot.sendMessage(chatId, '❗ Указанные кланы пока пусты.', {
          reply_to_message_id: msg.message_id
        });
      }

      // Группируем по кланам
      const byClan = new Map();
      for (const r of rows) {
        if (!byClan.has(r.clan)) byClan.set(r.clan, []);
        byClan.get(r.clan).push(r);
      }

      // Собираем текст для каждого клана
      let sections = [];
      for (const clan of clansToShow) {
        let members = byClan.get(clan) || [];

        // сортировка по алфавиту (сначала ник, если пуст — по тегу)
        members.sort((a, b) => {
          const nameA = (a.nickname || a.telegram_tag || '').toString();
          const nameB = (b.nickname || b.telegram_tag || '').toString();
          return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
        });

        const lines = members.map((m, i) => {
          const tag = escapeHtml(m.telegram_tag || '(без тега)');
          const nick = escapeHtml(m.nickname || '(без ника)');
          return `${i + 1}. ${tag} — ${nick}`;
        });

        const header = `Список участников клана Checkmate ${clan} — ${members.length}/${clanLimits[clan] ?? '—'}:`;
        sections.push(`<b>${escapeHtml(header)}</b>\n\n${lines.join('\n') || '—'}`);
      }

      const message = sections.join('\n\n');

      await sendInChunks(bot, chatId, message, {
        reply_to_message_id: msg.message_id,
        parse_mode: 'HTML'
      });

    } catch (err) {
      // Если бот кикнут из чата — Telegram вернёт 403
      console.error('❌ Ошибка при получении списков ников:', err);
      const text = /403/.test(String(err))
        ? '❌ Не могу писать в этот чат (бот не состоит в группе или кикнут).'
        : '❌ Ошибка при получении списков.';
      bot.sendMessage(chatId, text, { reply_to_message_id: msg.message_id }).catch(() => {});
    }
  });
};

