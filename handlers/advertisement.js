// commands/broadcastClan.js
const db = require("../handlers/db");
const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");

// Минимальная экранировка под Telegram HTML
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Пауза, чтобы не попасть под лимиты Telegram
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = function (bot) {
    bot.onText(/^\+объявление\s+([\s\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Только админ-чаты
    const allowed = await isAdminChat(chatId);
    if (!allowed) return;

    // Текст после команды
    const text = (match?.[1] || '').trim();
    if (!text) {
      return bot.sendMessage(
        chatId,
        "ℹ️ Добавьте текст объявления на новой строке после команды:\n\n+объявления\nТекст объявления…"
      );
    }

    // clan_id для этого чата
    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(
        chatId,
        "❌ Этот чат не привязан к клану. Сначала зарегистрируйте клан."
      );
    }

    // Получаем участников
    let ids = [];
    try {
      const res = await db.query(
        `
        SELECT DISTINCT actor_id
        FROM public.clan_members
        WHERE clan_id = $1 and active = true
          AND actor_id IS NOT NULL
      `,
        [clanId]
      );
      ids = (res.rows || [])
        .map((r) => Number(r.actor_id))
        .filter((x) => Number.isFinite(x));
    } catch (err) {
      console.error("DB error broadcast:", err);
      return bot.sendMessage(chatId, "❌ Ошибка базы при получении участников.");
    }

    if (!ids.length) {
      return bot.sendMessage(
        chatId,
        "⚠️ Нет участников с активным личным чатом бота (telegram_id)."
      );
    }

    const options = { parse_mode: "HTML", disable_web_page_preview: true };
    const body = escapeHtml(text) + "\n(сообщение сгененировано админстраицей клана)";
   
    let ok = 0;
    const failed = [];

    for (const uid of ids) {
      await sleep(45);
      try {
        await bot.sendMessage(uid, body, options);
        ok++;
      } catch (err) {
        failed.push({
          uid,
          code: err?.response?.statusCode,
          err: String(err?.message || err),
        });
      }
    }

    const failLines = failed
      .slice(0, 10)
      .map((f) => `• ${f.uid} — код ${f.code || "?"}`);
    const more = failed.length > 10 ? `\n…и ещё ${failed.length - 10}` : "";

    const summary = [
      "📢 <b>Рассылка завершена</b>",
      `✅ Доставлено: <b>${ok}</b>`,
      `❌ Не доставлено: <b>${failed.length}</b>`,
      failLines.join("\n"),
      more,
    ]
      .filter(Boolean)
      .join("\n");

    await bot.sendMessage(chatId, summary, { parse_mode: "HTML", reply_to_message_id: msg.message_id, });
  });
};
