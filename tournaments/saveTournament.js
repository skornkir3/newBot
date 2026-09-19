const db = require("../handlers/db");
const isTournamentPost = require("../tournaments/isTournament");
const { parseTournamentPost } = require("../tournaments/parseTournaments");

module.exports = function registerSaveTournamentFromGroupPost(bot) {
    bot.on("channel_post", async (msg) => {
        try {
            // Только группы / супергруппы
            if (!msg.chat || msg.chat.type !== "channel") {
                return;
            }

            // Текст либо из caption, либо из обычного message.text
            const text = msg.caption || msg.text || "";
            if (!text) return;
            console.log('registerSaveTournamentFromGroupPost');
            if (!isTournamentPost(text)) return;
            console.log('it is tournamentPost');
            const parsed = parseTournamentPost(text);

            if (!parsed.startAt) {
                console.log("Не удалось распарсить дату/время турнира");
                return;
            }

            const title = msg.chat.title || "Без названия";
            const telegramChatId = String(msg.chat.id);
            const telegramMessageId = msg.message_id;
            const maps = parsed.maps;
            const rawText = parsed.rawText;

            // если хочешь хранить отдельно date/time текстом
            const dd = String(parsed.dateObj.day).padStart(2, "0");
            const mm = String(parsed.dateObj.month).padStart(2, "0");
            const yyyy = String(parsed.dateObj.year);
            const hh = String(parsed.timeObj.hours).padStart(2, "0");
            const mi = String(parsed.timeObj.minutes).padStart(2, "0");

            const dateText = `${dd}.${mm}.${yyyy}`;
            const timeText = `${hh}:${mi}`;

            const createdAt = new Date(
                parsed.dateObj.year,
                parsed.dateObj.month - 1,
                parsed.dateObj.day,
                parsed.timeObj.hours,
                parsed.timeObj.minutes
            );

            const team_size = 4;
            const clan_id = 2;
            // Можно защититься от дублей по chat_id + message_id
            const sql = `
        INSERT INTO tournaments (
          name,
          clan_id,
          created_at,
          team_size,
          maps
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

            const values = [
                title,
                clan_id,
                createdAt,
                team_size,
                maps,
            ];

            const result = await db.query(sql, values);

            if (result.rows.length > 0) {
                console.log(`Турнир сохранён: ${title}`);
            } else {
                console.log("Такой пост уже был сохранён ранее");
            }
        } catch (err) {
            console.error("Ошибка сохранения турнира из поста:", err);
        }
    });
};