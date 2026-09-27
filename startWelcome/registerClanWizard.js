const db = require("../handlers/db");
const getPlayerDescription = require('./../db/getDescriptionDb');
const registerCallback = require("./registerCallback");
const registerClan = require("./registerClanDb");
const deactivateOwnerClans = require("../clan/deactivateOwnerClans");
const wizardState = require("../clan/stateWiizard"); 


function escapeMarkdown(text) {
  if (!text) return '—';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

// ===== Утилиты =====
function normText(s) {
  return (s || "").toString().trim();
}
function normDigits(s) {
  return (s || "").toString().replace(/\D+/g, "");
}
function toIntOrNull(s) {
  const n = parseInt((s || "").toString().trim(), 10);
  return Number.isFinite(n) ? n : null;
}
/** Возвращает корректный username (без @) или null */
function getValidUsername(from) {
  const u = from && from.username ? String(from.username).trim() : "";
  // Telegram username: 5..32 символов [A-Za-z0-9_]
  if (/^[A-Za-z0-9_]{5,32}$/.test(u)) return u;
  return null;
}

module.exports = function registerClanWizard(bot) {
  registerCallback(bot, wizardState);
  // ===== 1) Кнопка "Зарегистрировать клан" =====
  bot.on("callback_query", async (q) => {
    if (!q?.data || q.data !== "register_clan") return;
    if (q.message.chat.type !== "private") {
      return bot.answerCallbackQuery(q.id, {
        text: "Регистрировать клан можно только в личке бота.",
      });
    }

    const chatId = q.message.chat.id;
    const userId = q.from.id;

    // ✅ Требуем наличие username до старта мастера
    const uname = getValidUsername(q.from);
    if (!uname) {
      await bot.answerCallbackQuery(q.id, {
        text: "Нужен username в Telegram.",
        show_alert: true,
      });
      return bot.sendMessage(
        chatId,
        [
          "❗ Для регистрации клана нужен *username* в Telegram.",
          "",
          "Как установить:",
          "1) Откройте *Настройки* Telegram.",
          "2) Нажмите *Изменить профиль* → *Имя пользователя*.",
          "3) Установите имя (5–32 символа: латиница, цифры, _ ).",
          "",
          "После этого снова нажмите кнопку «Зарегистрировать клан».",
        ].join("\n"),
        { parse_mode: "Markdown" },
      );
    }

    wizardState.set(userId, { step: "ask_clan_name", payload: {} });
    await bot.answerCallbackQuery(q.id);
    await bot.sendMessage(
      chatId,
      '✍️ Введите название вашего клана (например, "Black Knights").',
    );
  });

  // ===== 2) Шаги мастера регистрации (только ЛС) =====
  bot.on("message", async (msg) => {
    if (msg.chat.type !== "private") return;
    const userId = msg.from.id;
    const s = wizardState.get(userId);
    if (!s) return;

    const p = s.payload;
    p.updatePlayer = false;

    // 2.1 Название клана
    if (s.step === "ask_clan_name") {
      const name = normText(msg.text);
      if (!name) return bot.sendMessage(msg.chat.id, "Введите название.");
      p.clan_name = name;
      s.step = "ask_chat_link";
      return bot.sendMessage(
        msg.chat.id,
        "✅ Введите ссылку приглашения в чат клана.",
      );
    }

    if (s.step === "ask_chat_link") {
      const link = normText(msg.text);
      p.clan_link = link;
      s.step = "continue_after_link";
    }

    // 2.2 Продолжаем сразу после ссылки, без проверочного кода
    if (s.step === "continue_after_link") {
      const state = wizardState.get(userId) || { step: null, payload: {} };
    //  const p = state.payload || (state.payload = {});

      const player = await getPlayerDescription(userId);

      if (player) {
        state.step = "confirm_existing_profile"; // этот шаг нужен для кнопок
        p.updatePlayer = true;
        p.leaderId = userId;

        const text = [
          "🧾 *Ваше описание:*",
          "",
          `👤 Имя:  ${escapeMarkdown(player.name)}`,
          `🏷 Ник:  ${escapeMarkdown(player.nick)}`,
          `🎮 PUBG ID: \` ${escapeMarkdown(player.pubgId)}\``,
          `🎂 Возраст:  ${escapeMarkdown(player.age)}`,
          `📍 Город:  ${escapeMarkdown(player.city)}`,
          "",
          "*Вы уже зарегистрированы в системе с этим описанием.*",
          "Хотите *использовать его и продолжить* или *изменить* данные?",
        ].join("\n");

        wizardState.set(userId, state);

        await bot.sendMessage(msg.chat.id, text, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Использовать и продолжить",
                  callback_data: "use_existing_continue",
                },
              ],
              [{ text: "✏️ Изменить", callback_data: "use_existing_edit" }],
            ],
          },
        });
        return;
      }

      // если игрока нет — идём обычным путём
      state.step = "ask_leader_name";
      wizardState.set(userId, state);
      return bot.sendMessage(msg.chat.id, "👤 Введите имя (как зовут).");
    }


    // 2.3 Имя лидера
    if (s.step === "ask_leader_name") {
      const leaderName = normText(msg.text);
      if (!leaderName) return bot.sendMessage(msg.chat.id, "Введите имя.");
      p.leader_name = leaderName;
      s.step = "ask_leader_nick";
      return bot.sendMessage(msg.chat.id, "🏷 Введите ник (в игре).");
    }

    // 2.4 Ник лидера
    if (s.step === "ask_leader_nick") {
      const leaderNick = normText(msg.text);
      if (!leaderNick) return bot.sendMessage(msg.chat.id, "Введите ник.");
      p.leader_nick = leaderNick;
      s.step = "ask_leader_pubg_id";
      return bot.sendMessage(msg.chat.id, "🎮 Введите PUBG ID (только цифры).");
    }

    // 2.5 PUBG ID лидера
    if (s.step === "ask_leader_pubg_id") {
      const pubgId = normDigits(msg.text);
      if (!pubgId)
        return bot.sendMessage(msg.chat.id, "Введите PUBG ID (только цифры).");
      p.leader_pubg_id = pubgId;
      s.step = "ask_leader_age";
      return bot.sendMessage(msg.chat.id, "🎂 Введите ваш возраст (число).");
    }

    // 2.6 Возраст лидера
    if (s.step === "ask_leader_age") {
      const age = toIntOrNull(msg.text);
      if (!age || age < 10 || age > 99) {
        return bot.sendMessage(
          msg.chat.id,
          "Введите корректный возраст (10–99).",
        );
      }
      p.leader_age = age;
      s.step = "ask_leader_city";
      return bot.sendMessage(msg.chat.id, "📍 Введите город.");
    }

    // 2.7 Город лидера → финал (создание клана + лидера)
    if (s.step === "ask_leader_city") {
      const city = normText(msg.text);
      if (!city)
        return bot.sendMessage(msg.chat.id, "Введите корректный город.");
      p.leader_city = city;

      const clanName = p.clan_name;

      // 🔁 Повторная проверка username перед записью в БД
      const username = getValidUsername(msg.from);
      if (!username) {
        wizardState.delete(userId);
        return bot.sendMessage(
          msg.chat.id,
          [
            "❗ Нельзя завершить регистрацию — у вашего аккаунта нет корректного *username*.",
            "",
            "Как установить:",
            "1) Откройте *Настройки* Telegram.",
            "2) *Имя пользователя* → задайте имя (5–32 символа: латиница, цифры, _ ).",
            "",
            "После этого начните регистрацию заново.",
          ].join("\n"),
          { parse_mode: "Markdown" },
        );
      }
      const telegramTag = "@" + username;
      console.log(p);
      try {
        await deactivateOwnerClans(userId);
        await registerClan(clanName, userId, telegramTag, p, wizardState);
        await bot.sendMessage(
          msg.chat.id,
          [
            `🎉 Клан «${clanName}» зарегистрирован!`,
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
            msg.chat.id,
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
    }
  });
};
