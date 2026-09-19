// modules/onNewMember.js
module.exports = function (bot) {
  bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;

    for (const user of msg.new_chat_members) {
      // Собираем имя
      const name = user.username
        ? `@${user.username}`
        : [user.first_name, user.last_name].filter(Boolean).join(' ');

      // Текст приветствия
      const text = `

Приветствуем тебя, ${name}, и добро пожаловать в  нашу семью! 💖🤗
      `;

      try {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Ошибка приветствия:', err);
      }
    }
  });
};