// modules/register/existingProfileCallback.js
/**
 * Обработка нажатий по кнопкам выбора существующего профиля.
 *
 * Используется внутри мастера регистрации клана.
 * 
 * Сценарии:
 *  - "✅ Использовать и продолжить" → перенос без изменения полей.
 *  - "✏️ Изменить" → продолжение мастера с вводом имени/ника.
 */
const registerClan = require("./registerClanDb");
const getPlayerDescription = require('./../db/getDescriptionDb');
const deactivateOwnerClans = require("../clan/deactivateOwnerClans");
const { chat } = require("googleapis/build/src/apis/chat");
const deactivateClanInviteDB = require("../db/deactivateClanInviteDB");


module.exports = function handleExistingProfileCallback(bot, wizardState) {
  bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const s = wizardState.get(userId);
    if (!s) return;
    const chatId = q.message.chat.id;
    if (s.step === 'confirm_existing_profile') {
      if (q.data === 'use_existing_continue') {    
        // режим: перенос без изменения полей
        s.payload.useExistingMode = 'reuse';
        s.step = 'finalize_registration'; // переходим к финальному шагу
        wizardState.set(userId, s);
        const p = s.payload;
        const player = await getPlayerDescription(p.leaderId);
        p.leader_name = player.name;
        p.leader_nick = player.nick;
        p.leader_pubg_id = player.pubgId;
        p.leader_age = player.age;
        p.leader_city = player.city;
        p.updatePlayer = true;
        let telegramTag = null;
        if (q.from.username) {
          telegramTag = '@' + q.from.username.trim();
        }
        await bot.answerCallbackQuery(q.id, { text: 'Используем ваш текущий профиль.' });
        await bot.sendMessage(q.message.chat.id, 'Продолжаю регистрацию клана…');
        
        try {
          await deactivateOwnerClans(userId);
          const clanId = await registerClan(p.clan_name, userId, telegramTag, p, wizardState);
          await deactivateClanInviteDB(clanId, p.inviteCode);
          await bot.sendMessage(
            chatId,
            [
              `🎉 Клан «${p.clan_name}» зарегистрирован!`,
              `👑 Лидер: ${p.leader_name} (${p.leader_nick}), PUBG ID: ${p.leader_pubg_id}, ${p.leader_age} лет, ${p.leader_city}.`,
              "",
              "Дальше:",
              "1) Добавьте бота в **админ-чат**, выдайте админские права и напишите там: `!привязать админку`.",
              "2) Добавьте бота в **обычные** чаты клана и в каждом напишите: `!привязать чат`.",
            ].join("\n"),
            { parse_mode: "Markdown" },
          );

          wizardState.delete(userId);
        } catch (err) {
          try {
            await db.query("ROLLBACK");
          } catch (_) {}
          console.error("register clan FINAL error", {
            code: err.code,
            constraint: err.constraint,
            table: err.table,
            detail: err.detail,
          });
          if (err && err.code === "23505") {
            return bot.sendMessage(
              chatId,
              "⚠️ У вас уже есть активный клан. Сначала деактивируйте его, чтобы создать новый.",
            );
          }
          console.error("register clan FINAL error", err);
          bot.sendMessage(
            msg.chat.id,
            "❌ Ошибка при регистрации. Попробуйте позже.",
          );
          wizardState.delete(userId);
        }
        return;
      }

      if (q.data === 'use_existing_edit') {
        console.log('edit');
        // режим: редактирование данных игрока (обновим существующую запись)
        s.payload.useExistingMode = 'edit';
        s.payload.updateExisting = true; // важный флаг
        s.step = 'ask_leader_name';      // продолжим как обычно (имя → ник → …)
        wizardState.set(userId, s);

        await bot.answerCallbackQuery(q.id);
        await bot.sendMessage(q.message.chat.id, '👤 Введите имя (как зовут).');
        return;
      }
    }
  });
};
