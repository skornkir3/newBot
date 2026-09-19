// modules/registerClanWizard.js
const db = require('../handlers/db');
const getClanId = require('../clan/getClanId');
const handleChannelForward = require("../handlers/channelForward");

module.exports = function bindChats(bot) {
  bot.onText(/^!привязать\s+админку$/iu, async (msg) => {
    console.log('bind');
    if (msg.chat.type === 'private') {
      return bot.sendMessage(msg.chat.id, 'Команду нужно писать в админ-чате клана.');
    }

    const adminChatId = msg.chat.id;
    const ownerId = msg.from.id;

    try {
      const { rows } = await db.query(
        `SELECT id FROM clans WHERE owner_actor_id = $1 AND is_active = TRUE LIMIT 1`,
        [ownerId]
      );
      if (!rows.length) {
        return bot.sendMessage(adminChatId, 'Сначала зарегистрируйте клан в личке бота.');
      }

      const clanId = rows[0].id;
      await db.query(
        `UPDATE clans
            SET admin_chat_id = $1
          WHERE id = $2`,
        [adminChatId, clanId]
      );

      await bot.sendMessage(
        adminChatId,
        `✅ Этот чат закреплён как *админ-чат* клана #${clanId}.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error('bind_admin error', err);
      console.error('register clan FINAL error', {
        code: err.code, constraint: err.constraint, table: err.table, detail: err.detail
      });
      bot.sendMessage(adminChatId, '❌ Не удалось привязать админ-чат.');
    }
  });

  // ===== 4) Привязка ОБЫЧНОГО чата (много на клан) =====
  // команда: !привязать чат
  bot.onText(/^!привязать\s+чат$/iu, async (msg) => {
    if (msg.chat.type === 'private') {
      return bot.sendMessage(msg.chat.id, 'Команду нужно писать в групповом чате клана.');
    }

    const chatId = msg.chat.id;
    const ownerId = msg.from.id;

    try {
      const { rows } = await db.query(
        `SELECT id FROM clans WHERE owner_actor_id = $1 AND is_active = TRUE LIMIT 1`,
        [ownerId]
      );
      if (!rows.length) {
        return bot.sendMessage(chatId, 'Сначала зарегистрируйте клан в личке бота.');
      }

      const clanId = rows[0].id;

      await db.query(
        `INSERT INTO clan_member_chats (clan_id, chat_id, active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (chat_id) DO UPDATE
           SET clan_id = EXCLUDED.clan_id,
               active = TRUE`,
        [clanId, chatId]
      );
      await bot.sendMessage(chatId, `✅ Чат привязан к клану.`, { parse_mode: 'Markdown' });
      const nameTgk = "@winepubgm";
      try {
        await handleChannelForward(bot, nameTgk, chatId);
      } catch (err) {
        console.error(`⚠️ Ошибка при репосте в ${chatId}:`, err.message);
      }
    } catch (e) {
      console.error('bind_member error', e);
      bot.sendMessage(chatId, '❌ Не удалось привязать чат.');
    }
  });
};
