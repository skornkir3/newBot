const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");
const db = require("../handlers/db");

function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function normClanNumber(s) {
  const n = parseInt(String(s || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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

module.exports = function registerAddModeration(bot) {
  // +модерация @тег номерКлана
  bot.onText(/^\+модерация\s+@?(\S+)\s+(\d+)\s*$/iu, async (msg, match) => {
    const chatId = msg.chat.id;
    console.log("+moderation");
    const allowed = await isAdminChat(chatId);
    if (!allowed) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, "❌ Этот чат не привязан к клану.", {
        reply_to_message_id: msg.message_id,
      });
    }

    const username = "@" + extractUsername(match?.[1]);
    const number = normClanNumber(match?.[2]);

    if (!username || !number) {
      return bot.sendMessage(chatId, "⚠️ Пример: <code>+модерация @Nick 1</code>", {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // 1) пробуем найти actor_id по username в clan_members
      const memberRes = await db.query(
        `
        select actor_id, telegram_tag, nickname
        from clan_members
        where clan_id = $1
          and lower(telegram_tag) = lower($2)
        limit 1
        `,
        [clanId, username]
      );
      console.log(username)
      let actorId = memberRes.rows?.[0]?.actor_id || null;

      // 2) если не нашли — пробуем реплай
      if (!actorId) {
        const replied = msg.reply_to_message?.from;
        if (replied?.id) actorId = replied.id;
      }

      if (!actorId) {
        return bot.sendMessage(
          chatId,
          "⚠️ Не могу получить <b>actor id</b> по @тегу.\n" +
            "Пример: <code>+модерация @Nick 1</code>",
          { parse_mode: "HTML", reply_to_message_id: msg.message_id }
        );
      }

      await db.query(
        `
        insert into clan_moderators (clan_id, number, actor_id)
        values ($1, $2, $3)
        on conflict (clan_id, number, actor_id) do nothing
        `,
        [clanId, number, actorId]
      );

      // красиво подтвердим — берём @ и ник из clan_members по actor_id (если есть)
      const infoRes = await db.query(
        `
        select telegram_tag, nickname
        from clan_members
        where clan_id = $1 and actor_id = $2
        limit 1
        `,
        [clanId, actorId]
      );

      const u = infoRes.rows?.[0]?.telegtam_tag || username;
      const nick = infoRes.rows?.[0]?.nickname || "—";

      return bot.sendMessage(
        chatId,
        `✅ Зам назначен: <b>${escapeHtml(formatTag(u))}</b> ${escapeHtml(nick)} → клан <b>${number}</b>`,
        { parse_mode: "HTML", reply_to_message_id: msg.message_id }
      );
    } catch (e) {
      console.error("+модерация error:", e);
      return bot.sendMessage(chatId, "❌ Ошибка при сохранении модерации.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
