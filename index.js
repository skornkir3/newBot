const TelegramBot = require("node-telegram-bot-api");
const {
  notifyChatId,
  threadMessageId,
  inviteLink1,
  inviteLink2,
} = require("./config");
// test web

require("dotenv").config(); // Загружает переменные из .env
const token = process.env.TELEGRAM_TOKEN2;


const bot = new TelegramBot(token, {
  polling: {
    params: {
      allowed_updates: JSON.stringify([
        "message",
        "callback_query",
        "chat_member",
        "my_chat_member",
      ]),
    },
  },
});

// Обработка ошибок polling
bot.on("polling_error", (error) => {
  console.log("Детали ошибки polling:", error.code, error.message);
  if (error.code === "EFATAL") {
    console.log(
      "Критическая ошибка - возможно неверный токен или бот уже запущен",
    );
  }
});

bot.on("error", (error) => {
  console.log("Общая ошибка бота:", error);
});
const usernameMap = new Map();

const testConnection = require("./handlers/dbconnection");

require("./handlers/memberHandlers")(bot, notifyChatId, threadMessageId);
require("./handlers/inviteGenerator")(bot); // ← генератор инвайтов
require("./handlers/inviteClanGenerator")(bot); // ← генератор инвайтов
require("./handlers/banMember")(bot);
require("./handlers/unbanMember")(bot);
require("./handlers/clanJoinBot")(bot, notifyChatId, inviteLink1, inviteLink2);
require("./handlers/getBanList")(bot);
require("./handlers/marriage")(bot);
require("./handlers/listMarriage")(bot);

require("./handlers/landmate")(bot);
// require('./scripts/warmupCities');
require("./handlers/greetings")(bot);
require("./handlers/infoPlaces")(bot);
const marryProposal = require("./handlers/marriageProposal");
marryProposal(bot);
require("./handlers/divorce")(bot);
require("./clan/createSubClan")(bot);

require("./update/setAge")(bot);
require("./update/setCity")(bot);
require("./update/setName")(bot);
require("./update/help")(bot);
require("./update/setNote")(bot);
require("./handlers/listNick")(bot);
require("./handlers/changeTagNotification")(bot, notifyChatId);

require("./handlers/getDescription")(bot);
require("./handlers/getClanList")(bot);
require("./handlers/findMember")(bot);
require("./handlers/ruleClan")(bot);
require("./handlers/afterJoinMember")(bot);
require("./handlers/advertisement")(bot);

require("./handlers/deleteAccounts")(bot);
require("./handlers/activityTracker")(bot);
require("./messages/activityInfo")(bot);
require("./startWelcome/registerClanWizard")(bot);
require("./startWelcome/bindChats")(bot);
require("./handlers/muteMember")(bot);
require("./handlers/broadcastAll")(bot);

require("./update/updateClan")(bot);
require("./update/setNick")(bot);
require("./update/setPubgId")(bot);
require("./handlers/saveActorIdbyMessage")(bot);
require("./handlers/getTelegramInfo")(bot);

require("./tournaments/tournament")(bot);
require("./tournaments/participants")(bot);
require("./tournaments/listParticipants")(bot);
require("./tournaments/removeTeam")(bot);
require("./tournaments/lobby")(bot);
// require("./tournaments/ocrResults")(bot);
// require("./tournaments/ocrResults2")(bot);
require("./tournaments/geminiOcr")(bot);
require("./tournaments/viewTournamentResults")(bot);
require("./tournaments/finishTournament")(bot);
require("./tournaments/dateTournament")(bot);
require("./tournaments/saveTournament")(bot);

// require("./apiPubg/commandInfo")(bot);
require("./premium/premium")(bot);
require("./premium/premiumPayment")(bot);
require("./premium/premiumSuccess")(bot);

require("./moderation/addModeration")(bot);
require("./moderation/removeModeration")(bot);
require("./moderation/listModeration")(bot);
require("./moderation/myLeader")(bot);
require("./clan/changeLeaderClan")(bot);

require("./clan/setInviteLink")(bot);
require("./clan/setInviteMemberLimit")(bot);

const testData = require("./handlers/testData");

const forward = require("./forward/forwardNews");
forward(bot);
const forwardKir = require("./forward/forwardKir");
forwardKir(bot);
// testData(bot);

//const keepAlive = require("./keepAlive"); // ← подключаем сервер
const keepAlive = require("./keepAlive");
const registerStreamStartHook = require("./Stream/stream");

/*keepAlive((app) => {
  registerStreamStartHook(app, bot);
});*/
// 🟢 Запускаем HTTP-сервер (не даст Replit заснуть)

const getUserInfo = require("./handlers/getUserInfo");
bot.on("message", (msg) => getUserInfo(bot, msg, token));
keepAlive();
