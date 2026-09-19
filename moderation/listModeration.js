const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");
const db = require("../handlers/db");

function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatTag(username) {
  if (!username) return "—";
  const u = String(username);
  return u.startsWith("@") ? u : `@${u}`;
}

module.exports = function registerListModeration(bot) {
  // !модерация
  bot.onText(/^!модерация\s*$/iu, async (msg) => {
    const chatId = msg.chat.id;
    console.log("moder list");
 //   const allowed = await isAdminChat(chatId);
  //  if (!allowed) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, "❌ Этот чат не привязан к клану.", {
        reply_to_message_id: msg.message_id,
      });
    }

    try {
      // Все номера кланов, где есть subclans или модеры
      const numsRes = await db.query(
        `
        select distinct number from subclans where clan_id = $1
        union
        select distinct number from clan_moderators where clan_id = $1
        order by number asc
        `,
        [clanId]
      );

      if (numsRes.rows.length === 0) {
        return bot.sendMessage(chatId, "ℹ️ Нет данных по сабкланам/модерации.", {
          reply_to_message_id: msg.message_id,
        });
      }

      const blocks = [];

      for (const r of numsRes.rows) {
        const number = r.number;

        // Лидер: subclans -> clan_members
        // IMPORTANT: sc.leader_actor_id замени на реальное поле лидера в subclans
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
        const leaderTag = leaderRow?.telegram_tag;
        const leaderNick = leaderRow?.nickname || "—";

        // Замы: clan_moderators -> clan_members
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
        lines.push(`<b>Клан ${number}</b>`);
        lines.push(`Лидер <b>${escapeHtml(leaderTag)}</b> ${escapeHtml(leaderNick)}`);

        if (modsRes.rows.length === 0) {
         // lines.push(`Замов нет`);
        } else {
          for (const m of modsRes.rows) {
            const tag = formatTag(m.telegram_tag);
            const nick = m.nickname || "—";
            lines.push(`Зам <b>${escapeHtml(tag)}</b> ${escapeHtml(nick)}`);
          }
        }

        blocks.push(lines.join("\n"));
      }

      return bot.sendMessage(chatId, blocks.join("\n\n"), {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    } catch (e) {
      console.error("!модерация error:", e);
      return bot.sendMessage(chatId, "❌ Ошибка при получении списка модерации.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
};
