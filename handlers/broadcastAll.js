// commands/broadcastAll.js
const db = require("../handlers/db");

// Минимальная экранировка под Telegram HTML
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Пауза, чтобы не попасть под лимиты Telegram
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OWNER_TG_ID = 6036046121;

module.exports = function (bot) {
  bot.onText(/^\+рассылка\s+([\s\S]+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromId = msg?.from?.id;

    // Только один человек
    if (fromId !== OWNER_TG_ID) {
      return bot.sendMessage(chatId, "⛔ Доступ запрещён.", {
        reply_to_message_id: msg.message_id,
      });
    }

    // Текст после команды
    const text = (match?.[1] || "").trim();
    if (!text) {
      return bot.sendMessage(
        chatId,
        "ℹ️ Добавьте текст на новой строке после команды:\n\n+рассылка\nТекст сообщения…",
        { reply_to_message_id: msg.message_id }
      );
    }

    // Получаем всех активных участников (у которых есть actor_id)
    let ids = [];
    try {
      const res = await db.query(
        `
        SELECT DISTINCT actor_id
        FROM public.clan_members
        WHERE actor_id IS NOT NULL
        `
      );

      ids = (res.rows || [])
        .map((r) => Number(r.actor_id))
        .filter((x) => Number.isFinite(x));
    } catch (err) {
      console.error("DB error broadcast all:", err);
      return bot.sendMessage(chatId, "❌ Ошибка базы при получении участников.", {
        reply_to_message_id: msg.message_id,
      });
    }  
//return;
    if (!ids.length) {
      return bot.sendMessage(chatId, "⚠️ Нет активных участников для рассылки.", {
        reply_to_message_id: msg.message_id,
      });
    }

    const options = { parse_mode: "HTML", disable_web_page_preview: true };
    const body =
      escapeHtml(text) + "\n\n<i>(сообщение отправлено администратором)</i>";

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
      .map((f) => `• <code>${f.uid}</code> — код ${f.code || "?"}`);
    const more = failed.length > 10 ? `\n…и ещё ${failed.length - 10}` : "";

    const summary = [
      "📣 <b>Глобальная рассылка завершена</b>",
      `👥 Получателей: <b>${ids.length}</b>`,
      `✅ Доставлено: <b>${ok}</b>`,
      `❌ Не доставлено: <b>${failed.length}</b>`,
      failed.length ? "\n<b>Ошибки (первые 10):</b>" : "",
      failLines.join("\n"),
      more,
    ]
      .filter(Boolean)
      .join("\n");

    await bot.sendMessage(chatId, summary, {
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
    });
  });
};
