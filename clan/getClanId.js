
const db = require('../handlers/db');

module.exports = async function (chatId) {
  try {
    // 1️⃣ Проверяем, есть ли клан с таким admin_chat_id
    const clanRes = await db.query(
      `SELECT id AS clan_id
         FROM public.clans
        WHERE admin_chat_id = $1 AND is_active = true
        LIMIT 1`,
      [chatId]
    );
    if (clanRes.rowCount > 0) {
      return clanRes.rows[0].clan_id;
    }

    // 2️⃣ Если не найдено — проверяем в clan_members_chats
    const memberChatRes = await db.query(
      `SELECT clan_id
         FROM public.clan_member_chats
        WHERE chat_id = $1
        LIMIT 1`,
      [chatId]
    );

    if (memberChatRes.rowCount > 0) {
      return memberChatRes.rows[0].clan_id;
    }

    // 3️⃣ Если ничего не найдено
    return 0;

  } catch (err) {
    console.error('❌ Ошибка при получении id клана:', err);
    return 0;
  }
};
