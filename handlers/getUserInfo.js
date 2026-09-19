const https = require('https');
const isAllowedChat = require('../admin/permissionChats');
const isAdminChat = require('../admin/permissionAdminChat');

// Функция получения информации о пользователе по actor_id
function getUserInfo(botToken, actorId) {
  const chatId = actorId.replace('user', '');
  const url = `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          json.ok ? resolve(json.result) : reject(new Error(json.description));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => reject(err));
  });
}

// Главный обработчик всех сообщений
async function handleMessage(bot, msg, botToken) {
  const text = msg.text || '';
  const chatId = msg.chat.id;

  // Обработка команды !тег
  if (text.startsWith('!тег')) {
    const parts = text.trim().split(' ');
    const actorId = parts[1];

    if (!actorId || !actorId.startsWith('user')) {
      return bot.sendMessage(chatId, '❗ Используй: !тег user123456789', {reply_to_message_id: msg.message_id });
    }

    try {
      const user = await getUserInfo(botToken, actorId);
      const name = user.first_name || '';
      const username = user.username ? `@${user.username}` : '⛔️ Юзернейм отсутствует';
      return bot.sendMessage(chatId, `👤 ${name} ${username}`,  
                {reply_to_message_id: msg.message_id });
    } catch (error) {
      return bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`, {reply_to_message_id: msg.message_id } );
    }
  }

  // Здесь можно добавлять другие команды в будущем:
  // if (text.startsWith('!инвайт')) { ... }
}

module.exports = handleMessage;
