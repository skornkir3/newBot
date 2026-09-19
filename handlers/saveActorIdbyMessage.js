// handlers/saveActorIdOnMessage.js
const db = require('./db');
const isAllowedChat = require('../admin/permissionChats');

// локальный кэш, чтобы не обновлять одно и то же по многу раз за один запуск
// ключ: @tag (lowercase), значение: actor_id
const cache = new Map();

function normalizeTag(username) {
  if (!username) return null;
  const tag = username.startsWith('@') ? username : `@${username}`;
  return tag.toLowerCase();
}

module.exports = function saveActorIdOnMessage(bot) {
  bot.on('message', async (msg) => {
    try {
      return;
      const chatId = msg.chat.id;
      if (!isAllowedChat(chatId)) return;

      const user = msg.from;
      // у некоторых пользователей может не быть публичного username
      const tag = normalizeTag(user.username);
      const actorId = user.id;

      if (!tag) return;                         // нечего сопоставлять
      const cached = cache.get(tag);
      if (cached === actorId) return;           // уже знаем актуальный id в кэше

      // обновляем только тех, у кого actor_id пустой/нулевой/не совпадает
      const { rowCount } = await db.query(
        `
        UPDATE public.clan_members
        SET actor_id = $2
        WHERE LOWER(telegram_tag) = $1
          AND (actor_id IS NULL OR actor_id = 0 OR actor_id <> $2)
        `,
        [tag, actorId]
      );

      if (rowCount > 0) {
        cache.set(tag, actorId);
        // можно залогировать при первом совпадении
        console.log(`✓ Привязал actor_id ${actorId} к ${tag}`);
      }

    } catch (err) {
      console.error('Ошибка при привязке actor_id:', err);
    }
  });

  // захватываем и событие вступления в чат — тоже хорошая точка для привязки
  bot.on('new_chat_members', async (msg) => {
    try {
      return;
      const chatId = msg.chat.id;
      if (!isAllowedChat(chatId)) return;

      for (const member of msg.new_chat_members) {
        const tag = normalizeTag(member.username);
        const actorId = member.id;
        if (!tag) continue;

        const cached = cache.get(tag);
        if (cached === actorId) continue;

        const { rowCount } = await db.query(
          `
          UPDATE public.clan_members
          SET actor_id = $2
          WHERE LOWER(telegram_tag) = $1
            AND (actor_id IS NULL OR actor_id = 0 OR actor_id <> $2)
          `,
          [tag, actorId]
        );

        if (rowCount > 0) {
          cache.set(tag, actorId);
          console.log(`✓ (join) Привязал actor_id ${actorId} к ${tag}`);
        }
      }
    } catch (err) {
      console.error('Ошибка при привязке actor_id (new_chat_members):', err);
    }
  });
};
