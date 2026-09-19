const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");
const db = require("../handlers/db");

function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function extractUsername(tag) {
  const t = String(tag || "").trim();
  if (!t) return null;
  return t.startsWith("@") ? t.slice(1) : t;
}
function formatTag(username) {
  if (!username) return "—";
  const u = String(username);
  return u.startsWith("@") ? u : `@${u}`;
}

module.exports = function registerRemoveModeration(bot) {
  // -модерация @тег
    bot.onText(/^-модерация\s+@?(\S+)\s*$/iu, async (msg, match) => {

    const chatId = msg.chat.id;

    const allowed = await isAdminChat(chatId);
    if (!allowed) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, "❌ Этот чат не привязан к клану.", {
        reply_to_message_id: msg.message_id,
      });
    }

    
      const username = "@" + extractUsername(match?.[1]);
    if (!username) {
      return bot.sendMessage(chatId, "⚠️ Пример: <code>-модерация @Nick</code>", {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // найдём actor_id по clan_members
      const memberRes = await db.query(
        `
        select actor_id
        from clan_members
        where clan_id = $1
          and lower(telegram_tag) = lower($2)
        limit 1
        `,
        [clanId, username]
      );

      const actorId = memberRes.rows?.[0]?.actor_id || null;
      if (!actorId) {
        return bot.sendMessage(
          chatId,
          `ℹ️ Не найден участник <b>${escapeHtml(formatTag(username))}</b>`,
          { parse_mode: "HTML", reply_to_message_id: msg.message_id }
        );
      }

      const delRes = await db.query(
        `delete from clan_moderators where clan_id = $1 and actor_id = $2`,
        [clanId, actorId]
      );

      if (delRes.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          `ℹ️ У <b>${escapeHtml(formatTag(username))}</b> нет роли “Зам”.`,
          { parse_mode: "HTML", reply_to_message_id: msg.message_id }
        );
      }

      return bot.sendMessage(
        chatId,
        `✅ Модерация удалена: <b>${escapeHtml(formatTag(username))}</b>`,
        { parse_mode: "HTML", reply_to_message_id: msg.message_id }
      );
    } catch (e) {
      console.error("-модерация error:", e);
      return bot.sendMessage(chatId, "❌ Ошибка при удалении модерации.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
