const getPlayerDescription = require("../../db/getDescriptionDb");

function hasUsername(from) {
    return Boolean(
        from &&
        typeof from.username === "string" &&
        from.username.trim().length > 0
    );
}

async function startSystemRegistration(bot, query, usersInProcess) {
    const chat = query.message?.chat;
    const chatId = chat?.id;
    const userId = query.from.id;

    await bot.answerCallbackQuery(query.id);

    if (chat?.type !== "private") {
        return bot.sendMessage(
            chatId,
            "Чтобы продолжить, напиши мне в личные сообщения и нажми /start."
        );
    }

    usersInProcess.delete(userId);

    if (!hasUsername(query.from)) {
        return bot.sendMessage(
            chatId,
            "⚠️ У тебя не установлен Telegram username.\n\n" +
            "Он нужен для регистрации в системе.\n\n" +
            "👉 Установи username в Telegram и нажми кнопку ниже.",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Проверить username",
                                callback_data: "register_check_username",
                            },
                        ],
                    ],
                },
            }
        );
    }

    const player = await getPlayerDescription(userId);
    if (player) {
        return bot.sendMessage(
            chatId,
            "✅ Ты уже зарегистрирован в системе Checkmate. Для изменения данных используй команды бота. Для полного списка команд просто напиши !команды"
        );
    }

    usersInProcess.set(userId, {
        step: "pubg_id",
        expectedChatId: chatId,
        registrationType: "system",
        data: {
            clan: "Без клана",
            clanId: 59,
        },
    });

    return bot.sendMessage(chatId, "Введи свой PUBG ID:");
}

module.exports = function registerToSystemCallback(bot, usersInProcess) {
    bot.on("callback_query", async (query) => {
        if (
            query.data !== "register_to_system" &&
            query.data !== "register_check_username"
        ) {
            return;
        }

        return startSystemRegistration(bot, query, usersInProcess);
    });
};