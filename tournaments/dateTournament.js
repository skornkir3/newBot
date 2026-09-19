const db = require('../handlers/db');
const isAdminChat = require('../admin/permissionAdminChat');
const getClanId = require('../clan/getClanId');

// Парсер формата "DD.MM.YYYY" или "DD.MM.YYYY HH:MM"
function parseRuDateTime(input) {
  const s = String(input || '').trim();

  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = m[4] !== undefined ? Number(m[4]) : 0;
  const MM = m[5] !== undefined ? Number(m[5]) : 0;

  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (HH < 0 || HH > 23) return null;
  if (MM < 0 || MM > 59) return null;

  // Локальная дата на сервере. Если у тебя в БД timestamptz — Postgres сам нормализует.
  const d = new Date(yyyy, mm - 1, dd, HH, MM, 0, 0);

  // Проверка на "съехавшую" дату (типа 31.02)
  if (
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd ||
    d.getHours() !== HH ||
    d.getMinutes() !== MM
  ) {
    return null;
  }

  return d;
}

module.exports = function registerSetTournamentDate(bot) {
  bot.onText(/^\+дата\s+турнира\s+(.+)$/iu, async (msg, match) => {
    const chatId = msg.chat.id;

    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, '❌ Этот чат не привязан к клану.', {
        reply_to_message_id: msg.message_id,
      });
    }

    const raw = (match[1] || '').trim();
    const dt = parseRuDateTime(raw);

    if (!dt) {
      return bot.sendMessage(
        chatId,
        '⚠️ Неверный формат даты.\n' +
          'Примеры:\n' +
          '• +дата турнира 23.11.2025 18:00\n' +
          '• +дата турнира 23.11.2025',
        { reply_to_message_id: msg.message_id }
      );
    }

    try {
      // Берём активный турнир
      const cur = await db.query(
        `
        SELECT id, name
        FROM tournaments
        WHERE clan_id = $1 AND active = true
        ORDER BY id DESC
        LIMIT 1
        `,
        [clanId]
      );

      if (cur.rowCount === 0) {
        return bot.sendMessage(chatId, '⚠️ Активный турнир не найден.', {
          reply_to_message_id: msg.message_id,
        });
      }

      const t = cur.rows[0];

      // В БД кладём ISO (UTC) — так стабильнее, чем "локальная строка"
      const iso = dt.toISOString();

      const upd = await db.query(
        `
        UPDATE tournaments
        SET created_at = $1::timestamptz
        WHERE id = $2 AND clan_id = $3
        RETURNING created_at
        `,
        [iso, t.id, clanId]
      );

      const saved = upd.rows[0].created_at;
      const pretty = new Date(saved).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      return bot.sendMessage(
        chatId,
        `✅ Дата турнира обновлена!\n\n` +
          `ID: ${t.id}\n` +
          `Название: ${t.name}\n` +
          `Новая дата: ${pretty}`,
        { reply_to_message_id: msg.message_id }
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, '⚠️ Ошибка при обновлении даты турнира.', {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
