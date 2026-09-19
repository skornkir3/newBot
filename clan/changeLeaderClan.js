const db = require("../handlers/db");
const isAdminChat = require("../admin/permissionAdminChat");
const getClanId = require("../clan/getClanId");

module.exports = function registerChangeSubclanLeader(bot) {
  bot.onText(/^!сменить\s+лидера\s+@(\w+)\s+(\d+)$/iu, async (msg, match) => {
    const chatId = msg.chat.id;

    const isAdmin = await isAdminChat(chatId);
    if (!isAdmin) return;

    const clanId = await getClanId(chatId);
    if (!clanId) {
      return bot.sendMessage(chatId, "❌ Этот чат не привязан к клану.");
    }

    const username = "@" + match[1];
    console.log(username);
    const subclanNumber = parseInt(match[2], 10);

    try {
      // 1️⃣ Получаем пользователя из clan_members
      const memberRes = await db.query(
        `SELECT actor_id 
         FROM clan_members 
         WHERE lower(telegram_tag) = lower($1)
         AND clan_id = $2`,
        [username, clanId]
      );

      if (memberRes.rows.length === 0) {
        return bot.sendMessage(
          chatId,
          "❌ Пользователь не найден в этом клане."
        );
      }

      const newLeaderActorId = memberRes.rows[0].actor_id;
      console.log(newLeaderActorId);
      // 2️⃣ Проверяем существует ли подклaн
      const subclanRes = await db.query(
        `SELECT id 
         FROM subclans 
         WHERE number = $1 
         AND clan_id = $2`,
        [subclanNumber, clanId]
      );

      console.log("newLeaderActorId");

      if (subclanRes.rows.length === 0) {
        return bot.sendMessage(
          chatId,
          "❌ Подклан с таким номером не найден."
        );
      }

      // 3️⃣ Обновляем лидера
      await db.query(
        `UPDATE subclans
         SET leader_actor_id = $1
         WHERE number = $2
         AND clan_id = $3`,
        [newLeaderActorId, subclanNumber, clanId]
      );
      console.log("sublclan");
      
      await bot.sendMessage(
        chatId,
        `✅ Лидер подклана №${subclanNumber} успешно изменён на ${username}`
      );
    } catch (err) {
      console.error("Ошибка смены лидера:", err);
      bot.sendMessage(chatId, "❌ Ошибка при смене лидера.");
    }
  });
};
