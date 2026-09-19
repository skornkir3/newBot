const db = require('../handlers/db');

module.exports = async function getAllChats() {

  const res = await db.query(
    `SELECT chat_id, clan_id
     FROM public.clan_member_chats`,
    []
  );
  if (res.rowCount > 0) {
  //  return res.rows.map(r => r.chat_id);
    return res.rows;
  }
  else{
    return [];
  }
  console.log(res.rows.map(r => r.chat_id));
  // Возвращаем массив строк (пустой массив, если ничего нет
};
