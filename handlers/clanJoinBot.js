const db = require('./db');
const fs = require('fs');
const saveDescription = require('./saveDescriptionFunc');
const saveMemberDb = require('./saveMemberDb');
const getPlayerDescription = require('./../db/getDescriptionDb');
const getClan = require('../clan/getClan');
const getSubClan = require('../clan/getSubClan');
const profileInviteCallback = require('../startWelcome/registerProfileInvite');
const registerToSystemCallback = require('./login/registerToSystem');
const addGameMode = require('../modes/addGameMode');
const usersInProcess = new Map();


function hasUsername(from) {
  return Boolean(from && typeof from.username === 'string' && from.username.trim().length > 0);
}

function escapeMarkdown(text) {
  if (!text) return '—';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

module.exports = function (bot, notifyChatId, inviteLink1, inviteLink2) {
 // const usersInProcess = require("../clan/stateWiizard");
  profileInviteCallback(bot, usersInProcess);
  registerToSystemCallback(bot, usersInProcess)
  // /start — только в личке
  bot.onText(/^\/start$/, (msg) => {
    if (msg.chat.type !== 'private') return; // игнор в группах

    const chatId = msg.chat.id;
    const welcomeText = 'Добро пожаловать в комьюнити Checkmate!';

    bot.sendPhoto(chatId, fs.readFileSync('./Images/IMG_3371.png'), {
      caption: welcomeText,
      filename: 'welcome_image.png',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Тгк ChessmanKir 🧩', url: 'https://t.me/chessmankirLive' },
            { text: 'Новости Pubg 🤝', url: 'https://t.me/winepubgm' }
          ],
          [
            { text: "Зарегистрироваться", callback_data: 'register_to_system'}
          ],
          [
            { text: 'Хочешь вступить в клан?', callback_data: 'join_clan' }
          ],
          [
            { text: '🛠 Зарегистрировать клан', callback_data: 'register_clan' }
          ]
        ]
      }
    });
  });

  // Кнопки
  bot.on('callback_query', async (query) => {
    const chat = query.message?.chat;
    const chatId = chat?.id;
    const userId = query.from.id;

    // Запрет запуска из групп/каналов
    if (chat?.type !== 'private') {
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(
        chatId,
        'Чтобы продолжить, напиши мне в личные сообщения и нажми /start.'
      );
    }

    // 0) Предпроверка username при клике "Хочешь вступить в клан?"
    if (query.data === 'join_clan') {
      await bot.answerCallbackQuery(query.id);

      usersInProcess.delete(userId);
      
      if (!hasUsername(query.from)) {
        // Нет username — объясняем и даём кнопку на повторную проверку
        return bot.sendMessage(chatId,
          '⚠️ У тебя не установлен Telegram username.\n\n' +
          'Это обязательное требование клана — по нему мы связываем анкеты и профили.\n\n' +
          '👉 Открой свой профиль Telegram и установи username (напр. ChessFan123). ' +
          'После этого нажми кнопку ниже, и я проверю ещё раз.',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Проверить username', callback_data: 'check_username' }
                ]
              ]
            }
          }
        );
      }

      // username есть — идём по обычному сценарию
      return bot.sendMessage(chatId, 'Ты хочешь вступить в клан?', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Да ✅', callback_data: 'join_yes' },
              { text: 'Нет ❌', callback_data: 'join_no' }
            ]
          ]
        }
      });
    }

    // 0.1) Повторная проверка по кнопке "Проверить username"
    if (query.data === 'check_username') {
      await bot.answerCallbackQuery(query.id);
      if (!hasUsername(query.from)) {
        // Всё ещё нет username — просим снова
        return bot.sendMessage(chatId,
          '❌ Username всё ещё не установлен.\n\n' +
          'Пожалуйста, зайди в профиль Telegram и задай username. ' +
          'Затем нажми кнопку ниже, чтобы я проверил ещё раз.',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Проверить username', callback_data: 'check_username' }
                ]
              ]
            }
          }
        );
      }

      // Отлично, теперь есть — продолжаем сценарий
      return bot.sendMessage(chatId, 'Отлично! Username найден ✅\n\nТы хочешь вступить в клан?', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Да ✅', callback_data: 'join_yes' },
              { text: 'Нет ❌', callback_data: 'join_no' }
            ]
          ]
        }
      });
    }

    if (query.data === 'join_no') {
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, 'Хорошо, может в следующий раз 😊', {
        reply_to_message_id: query.message.message_id
      });
    }

    if (query.data === 'join_yes') {
      await bot.answerCallbackQuery(query.id);

      // Доп. защита: если юзер дошёл сюда без username (почти невозможно, но на всякий случай)
      if (!hasUsername(query.from)) {
        return bot.sendMessage(chatId,
          '⚠️ Перед вступлением нужно установить Telegram username.\n' +
          'После установки нажми «Проверить username».',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Проверить username', callback_data: 'check_username' }
                ]
              ]
            }
          }
        );
      }

      // сохраняем, в каком чате идёт анкета (личка)
  /*    const player = await getPlayerDescription(userId);
      if (player != null && player.clanId == 1) {
        bot.sendMessage(chatId, 'Вы уже были в клане', {
          reply_to_message_id: query.message.message_id
        });
        return;
      } */

      usersInProcess.set(userId, { step: 'invite', expectedChatId: chatId, data: {} });
      return bot.sendMessage(chatId, 'Введи свой инвайт-код:', {
        reply_to_message_id: query.message.message_id
      });
    }
  });

  // Пошаговая анкета — только личка и только тот же чат
  bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private') return; // полностью игнорим группы/каналы

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();

    if (!text || text.startsWith('/')) return;
    if (!usersInProcess.has(userId)) return;

    const user = usersInProcess.get(userId);
    if (user.expectedChatId && user.expectedChatId !== chatId) return; // сообщение не из того чата

    // Шаг 1 — проверка инвайта
    if (user.step === 'invite') {
      const code = text;
      const res = await db.query(
        'SELECT * FROM invites WHERE invite_code = $1 AND is_active = true',
        [code]
      );
      if (res.rowCount === 0) {
        return bot.sendMessage(
          chatId,
          '❌ Код недействителен или уже использован. Введи снова:'
        );
      }
      user.data.inviteCode = code;
      user.data.clan = res.rows[0].clan_name;
      user.data.clanId = res.rows[0].clan_id;

      const player = await getPlayerDescription(userId);
      if (player) {
        user.step = "registration_invite_profile"; // этот шаг нужен для кнопок
        user.updatePlayerInvite = true;
        const text = [
        "🧾 *Ваше описание:*",
        "",
        `👤 Имя:  ${escapeMarkdown(player.name)}`,
        `🏷 Ник:  ${escapeMarkdown(player.nick)}`,
        `🎮 PUBG ID: \` ${escapeMarkdown(player.pubgId)}\``,
        `🎂 Возраст:  ${player.age}`,
        `📍 Город:  ${escapeMarkdown(player.city)}`,
        "",
        "*Вы уже зарегистрированы в системе с этим описанием.*",
        "Хотите *использовать его и продолжить* или *изменить* данные?",
      ].join("\n");

      await bot.sendMessage(msg.chat.id, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Использовать и продолжить",
                callback_data: "profile_invite_continue",
              },
            ],
            [{ text: "✏️ Изменить", callback_data: "profile_invite_edit" }],
          ],
        },
      });
        return
      }

      user.step = 'pubg_id';
      return bot.sendMessage(chatId, '✅ Код принят. Введи свой PUBG ID:');
    }

    // Шаг 2 — PUBG ID
    // Шаг 2 — PUBG ID
    if (user.step === 'pubg_id') {
      // проверяем, что только цифры
      const pubgId = text.replace(/\D+/g, ""); 

      if (!pubgId || pubgId.length < 5 || pubgId.length > 15) {
        return bot.sendMessage(
          chatId,
          "❌ PUBG ID должен состоять только из цифр.\nПопробуй ввести снова:"
        );
      }

      user.data.pubg_id = pubgId;
      user.step = 'name';
      return bot.sendMessage(chatId, 'Введи своё имя:');
    }


    // Шаг 3 — имя
    if (user.step === 'name') {
      user.data.name = text;
      user.step = 'nick';
      return bot.sendMessage(chatId, 'Введи свой игровой ник:');
    }

    // Шаг 3.1 — ник
    if (user.step === 'nick') {
      user.data.nick = text;
      user.step = 'age';
      return bot.sendMessage(chatId, 'Сколько тебе лет?');
    }

    // Шаг 4 — возраст
    if (user.step === 'age') {
      user.data.age = text;
      user.step = 'city';
      return bot.sendMessage(chatId, 'Из какого ты города?');
    }

    // Шаг 5 — город → сохраняем
    if (user.step === 'city') {
      user.data.city = text;

      const target_username = msg.from.username ? `@${msg.from.username}` : '';

      const dataToSave = {
        name: user.data.name,
        nick: user.data.nick || '',
        target_username,
        pubg_id: user.data.pubg_id,
        age: user.data.age,
        city: user.data.city,
        clan: user.data.clan || 1,
        actor_id: userId,
        date: 0, 
        clan_id: user.data.clanId
      };

      try {
        console.log(dataToSave);
        const resultCreateProfile = await saveMemberDb(dataToSave);
        console.log("result");
        console.log(resultCreateProfile);
        if (user.registrationType !== "system" && user.data.inviteCode) {
          await db.query('UPDATE invites SET is_active = false WHERE invite_code = $1', [
            user.data.inviteCode
          ]);
        }
        if (user.registrationType === "system") {
          await bot.sendMessage(
              chatId,
              "🎉 Ты зарегистрирован в системе Checkmate!"
          );
        } else {
          const clan = await getClan(user.data.clanId);
          let clanName = '';
          if (clan.name != false){
            clanName = clan.name;
          }
          const subClan = await getSubClan(user.data.clanId, user.data.clan);
          await bot.sendMessage(
              chatId,
              '🎉 Ты принят в клан! Добро пожаловать в клан ' + clanName + '♟️'
          );
          let inviteLink = '';
          if (subClan.invite_link != false){
            inviteLink = subClan.invite_link;
          }
          await bot.sendMessage(chatId, inviteLink);
        }
        try{
          addGameMode(resultCreateProfile.id);
        }
        catch(e){}

        
       /* if(user.data.clanId == 1){
          await saveDescription(dataToSave);
        }*/
        
      } catch (err) {
        console.error('❌ Ошибка при приёме в клан:', err);
        await bot.sendMessage(
          chatId,
          'Произошла ошибка при сохранении данных. Попробуй позже.'
        );
      } finally {
        usersInProcess.delete(userId);
      }
    }
  });
};