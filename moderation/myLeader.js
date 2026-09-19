// commands/myLeader.js
const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");
const db = require("../handlers/db");

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function formatTag(username) {
  if (!username) return "—";
  const u = String(username);
  return u.startsWith("@") ? u : `@${u}`;
}

module.exports = function registerMyLeader(bot) {
  // !мой лидер
  bot.onText(/^!мой\s+лидер\s*$/iu, async (msg) => {
    const chatId = msg.chat.id;
    const actorId = msg.from?.id;

  //  const allowed = await isAdminChat(chatId);
 //   if (!allowed) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, "❌ Этот чат не привязан к клану.", {
        reply_to_message_id: msg.message_id,
      });
    }

    if (!actorId) {
      return bot.sendMessage(chatId, "❌ Не удалось определить ваш actor_id.", {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // 1) Определяем номер сабклана (number) пользователя
      const myRes = await db.query(
        `
        select clan as number, telegram_tag, nickname
        from clan_members
        where clan_id = $1 and actor_id = $2
        limit 1
        `,
        [clanId, actorId]
      );

      const me = myRes.rows?.[0];
      if (!me || me.number == null) {
        return bot.sendMessage(
          chatId,
          "ℹ️ Я не нашёл вас в таблице участников этого клана (clan_members) или у вас не указан номер сабклана.",
          { reply_to_message_id: msg.message_id }
        );
      }

      const number = me.number;

      // 2) Лидер: subclans -> clan_members
      // IMPORTANT: если поле лидера в subclans другое — замени sc.leader_actor_id
      const leaderRes = await db.query(
        `
        select
          sc.leader_actor_id as actor_id,
          cm.telegram_tag,
          cm.nickname
        from subclans sc
        left join clan_members cm
          on cm.clan_id = sc.clan_id and cm.actor_id = sc.leader_actor_id
        where sc.clan_id = $1 and sc.number = $2
        limit 1
        `,
        [clanId, number]
      );

      const leaderRow = leaderRes.rows?.[0] || null;
      const leaderTag = formatTag(leaderRow?.telegram_tag);
      const leaderNick = leaderRow?.nickname || "—";

      // 3) Модерация (замы): clan_moderators -> clan_members
      const modsRes = await db.query(
        `
        select
          m.actor_id,
          cm.telegram_tag,
          cm.nickname
        from clan_moderators m
        left join clan_members cm
          on cm.clan_id = m.clan_id and cm.actor_id = m.actor_id
        where m.clan_id = $1 and m.number = $2
        order by m.created_at asc
        `,
        [clanId, number]
      );

      const lines = [];
      lines.push(`<b>Клан ${escapeHtml(number)}</b>`);
      lines.push(`Лидер <b>${escapeHtml(leaderTag)}</b> ${escapeHtml(leaderNick)}`);

      if (modsRes.rows.length > 0) {
        for (const m of modsRes.rows) {
          const tag = formatTag(m.telegram_tag);
          const nick = m.nickname || "—";
          lines.push(`Зам <b>${escapeHtml(tag)}</b> ${escapeHtml(nick)}`);
        }
      }

      return bot.sendMessage(chatId, lines.join("\n"), {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    } catch (e) {
      console.error("!мой лидер error:", e);
      return bot.sendMessage(chatId, "❌ Ошибка при получении модерации вашего клана.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
