// ./apiPubg/commandInfoId.js
const getInfoById = require("./getInfoById");

module.exports = function (bot) {

  bot.onText(/^!infoid\s+(\d{5,20})$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const pubgId = match[1];

    await bot.sendMessage(chatId, `🔍 Запрашиваю данные по PUBG ID: ${pubgId}...`);

    const data = await getInfoById(pubgId);

    // JSON пустой или ошибка
    if (!data || !data.user || !data.user.user_id) {
      await bot.sendMessage(chatId, "❌ Игрок не найден.");
      return console.log(`Игрок с ID ${pubgId} не найден.`);
    }

    // Выводим весь JSON в консоль
    console.log("===== PUBG MOBILE USER DATA =====");
    console.log(JSON.stringify(data, null, 2));

    await bot.sendMessage(
      chatId,
      `✅ Игрок найден!\nНик: ${data.user.nickname || "—"}`
    );
  });

};
