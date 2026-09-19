const db = require('./db');
const path = require('path');                   // NEW
const getPlayerDescription = require('./../db/getDescriptionDb');
const getClanLeaders = require('./../clan/getListLeaders');
/*const admins = [
  '@nurka7',
  '@chessmankir',
  '@winepubg',
  '@reqwil',
  '@ERROR_4002'
]; */

// Экранирование для classic Markdown (Telegram parse_mode: 'Markdown')
function escapeMd(s) {
  if (s === null || s === undefined) return '—';
  return String(s)
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

module.exports = function (bot) {
  bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;

    for (const newUser of msg.new_chat_members) {
      const actorId = newUser.id;

      try {
        // Проверяем наличие пользователя в базе
        const memberRes = await db.query(
          `SELECT clan, clan_id FROM clan_members WHERE actor_id = $1 AND active = TRUE LIMIT 1`,
          [actorId]
        );

        if (memberRes.rowCount === 0) {
          // Не найден в базе — игнорируем
          return;
        }

        const clan = Number(memberRes.rows[0].clan);
        const clanId = Number(memberRes.rows[0].clan_id);

        // валидные только 1..4
     /*   if (!(clan >= 1 && clan <= 5)) {
          return;
        }*/
        
        const admins = await getClanLeaders(clanId);
        const adminUsername = admins[clan - 1];
        const admin = await getPlayerDescription(adminUsername);
        if (!admin) {
          return;
        }

        // Сообщение в личку
        const welcomeMessage = (
`👋 Здравствуйте, ${escapeMd(newUser.first_name || '')}!
Добро пожаловать в клан.
Пожалуйста, ознакомься с нашими правилами. Напишите в чат клана слово "Правила" без кавычек`
        ).trim();

        // Пишем в ЛС (каждое отправляем отдельно, чтобы падение одного не ломало другие)
        try {
          await bot.sendMessage(actorId, welcomeMessage, { parse_mode: 'Markdown' });
        } catch (e) {
          // молча пропускаем, если закрыты ЛС
        }

        const welcomeMessage1 = `Для вступелния в клан в игре найдите профиль лидера клана и подайте заявку. Опиание вашего лидера клана ниже`;
        try {
          await bot.sendMessage(actorId, escapeMd(welcomeMessage1), { parse_mode: 'Markdown' });
        } catch (e) {}

        const response =
`📄 Описание игрока ${escapeMd(adminUsername)}:

👤 Имя: ${escapeMd(admin.name)}
🏷 Ник: ${escapeMd(admin.nick)}
🎮 PUBG ID: ${escapeMd(admin.pubgId)}
🎂 Возраст: ${escapeMd(admin.age)}
📍 Город: ${escapeMd(admin.city)}`;

        try {
          await bot.sendMessage(actorId, response.trim(), { parse_mode: 'Markdown' });
          const response1 = `Пожалуйста, подайте заявку в клан в игре. Как подать заявку в клан?`;
          await bot.sendMessage(actorId, response1.trim(), { parse_mode: 'Markdown' });
        } catch (e) {}

        try{
          // 3) КАРТИНКИ (между описанием и командами)                // NEW
          // Папка Images рядом с папкой handlers (скрин у тебя такой)
          const IMAGES_DIR = path.join(__dirname, '..', 'Images');   // NEW
          const steps = [                                            // NEW
            { file: path.join(IMAGES_DIR, 'IMG_5208.PNG'), caption: 'Вам необходимо найти лидера своего клана в игре. ID выше' },
            { file: path.join(IMAGES_DIR, 'IMG_5218.PNG'), caption: 'Слева в профиле увидеть клан и кликнуть на него' },
            { file: path.join(IMAGES_DIR, 'IMG_5209.PNG'), caption: 'Бросить запрос в клан' },
          ];
          // В ЛС лучше слать по одному — подписи гарантированно видны
          for (const s of steps) {
            try { await bot.sendPhoto(actorId, s.file, { caption: s.caption }); } catch {}
          }
        }
        catch (e){
          
        }


        const commandText = `
        📖 *Список доступных команд:*

        ▫️ *описание* — ваше описание.  
        В ответ на чужое сообщение возвращает описание того, кому вы отвечаете.  
        ▫️ *описание @тег* — описание человека по тегу.

        ✏️ *Изменение описания:*  
        • \`+ник\` — меняет ваш ник.  
        • \`+возраст\` — меняет ваш возраст.  
        • \`+город\` — меняет ваш город.  
        • \`+имя\` — меняет ваше имя (если заполнено неправильно).

        💍 *Браки:*  
        • \`!браки\` — список браков текущего чата.  
        • \`!брак @тег\` — предложение вступления в брак.  
        • \`!развод\` — расторжение отношений.

        📜 *Клан:*  
        • \`правила\` — правила клана.  
        • \`!земляк\` — список сокланов в радиусе 400 км от вашего города.
            `;

        
        try {
          await bot.sendMessage(actorId, commandText.trim(), { parse_mode: 'Markdown' });
        } catch (e) {}
      
        if (clanId == 1){
          const responseTdm = escapeMd(`Также у нас есть отдельный ТДМ чат https://t.me/+FcD2meW_yVMwYTNi`);
          await bot.sendMessage(actorId, responseTdm.trim(), { parse_mode: 'Markdown' });
          const responseMetro = escapeMd(`И есть отдельный Метро чат https://t.me/+MV5ObXuvM9s4Yzgy`);
          await bot.sendMessage(actorId, responseMetro.trim(), { parse_mode: 'Markdown' });
        }
      } catch (error) {
        console.error('❌ Ошибка при обработке нового участника:', error);
      }
    }
  });
};
