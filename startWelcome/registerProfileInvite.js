const { datastream } = require('googleapis/build/src/apis/datastream');
const getPlayerDescription = require('./../db/getDescriptionDb');
const getClan = require('../clan/getClan');
const getSubClan = require('../clan/getSubClan');
const db = require('../handlers/db');
const saveMemberDb = require('../handlers/saveMemberDb');

module.exports = function profileInviteCallback(bot, wizardState) {
  bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const s = wizardState.get(userId);
    if (!s) return;
    const chatId = q.message.chat.id;
    if (s.step === 'registration_invite_profile') {
      if (q.data === 'profile_invite_continue') {    
        console.log("comtinue");
        s.step = 'finalize_registration'; // переходим к финальному шагу
        wizardState.set(userId, s);
        const player = await getPlayerDescription(userId);
        let target_username = null;
        if (q.from.username) {
            target_username = '@' + q.from.username.trim();
        }

        const dataToSave = {
          name: player.name,
          nick: player.nick,
          target_username, // корректно
          pubg_id: player.pubgId,
          age: player.age,
          city: player.city,
          clan: s.data.clan,
          actor_id: userId,
          date: 0, 
          clan_id: s.data.clanId
        };
        await bot.answerCallbackQuery(q.id, { text: 'Используем ваш текущий профиль.' });
        await bot.sendMessage(q.message.chat.id, 'Продолжаю регистрацию профиля…');
        try {

          await saveMemberDb(dataToSave);
          await db.query(
            'UPDATE clan_members SET active = TRUE WHERE actor_id = $1',
            [userId]
          );
         /* await db.query('UPDATE invites SET is_active = false WHERE invite_code = $1', [
            user.data.inviteCode
          ]);*/
          const clan = await getClan(s.data.clanId);
          let clanName = '';
          if (clan.name != false){
            clanName = clan.name;
          }
          const subClan = await getSubClan(s.data.clanId, s.data.clan);
          await bot.sendMessage(
            chatId,
            '🎉 Ты принят в клан! Добро пожаловать в клан ' + clanName + '♟️'
          );
          let inviteLink = '';
          if (subClan.invite_link != false){
            inviteLink = subClan.invite_link;
          }
          await bot.sendMessage(chatId, inviteLink);
        } catch (err) {
          console.error('❌ Ошибка при приёме в клан:', err);
          await bot.sendMessage(
            chatId,
            'Произошла ошибка при сохранении данных. Попробуй позже.'
          );
        }
        finally {
           wizardState.delete(userId);
        }
        return;
      }

      if (q.data === 'profile_invite_edit') {
        console.log('edit');
        // режим: редактирование данных игрока (обновим существующую запись)
        s.updateProfileInvite = true
     //   s.payload.updateExisting = true; // важный флаг
        s.step = 'pubg_id';      // продолжим как обычно (имя → ник → …)
        wizardState.set(userId, s);

        await bot.answerCallbackQuery(q.id);
        await bot.sendMessage(q.message.chat.id, '✏️ Введи свой PUBG ID:');
        return;
      }
    }
  });
};
