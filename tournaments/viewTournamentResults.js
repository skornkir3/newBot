const isAdminChat = require('../admin/permissionAdminChat');
// const getActiveTournamentId = require('../db/getActiveTournamentId');
const getTournamentFinalResults = require('./getTournamentResults');
const getClanId = require('../clan/getClanId');

function formatFinalResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return 'По этому турниру ещё нет сохранённых результатов.';
  }

  const lines = [];

  results.forEach((team, index) => {
    const place = index + 1;
    const names = team.players.join(' + ');

    const totalPts = team.totalPts;
    const killsPts = team.killsPts;
    const placementPts = team.placementPts;
    const totalKills = team.totalKills;

    lines.push(
      `${place}) ${names} — ${totalPts} pts ` +
    //  `(киллы: ${killsPts} pts / плейсмент: ${placementPts} pts / ${totalKills} киллов)`
      `( плейсмент: ${placementPts} pts / ${totalKills} киллов)`
    );
  });

  return lines.join('\n');
}

module.exports = function registerTournamentFinalCommand(bot) {
  bot.onText(/^!итогтурнира$/i, async (msg) => {
    const chatId = msg.chat.id;
    console.log('!итогтур');
    const clanId = await getClanId(chatId);
    if (clanId != 1){return;}
    try {
      const isAdmin = await isAdminChat(chatId);
      if (!isAdmin) return;

    //  const tournamentId = await getActiveTournamentId(chatId);
      const tournamentId = 1;
      if (!tournamentId) {
        return bot.sendMessage(
          chatId,
          'Активный турнир для этого чата не найден.',
          { reply_to_message_id: msg.message_id }
        );
      }

      const results = await getTournamentFinalResults(tournamentId);

      const header = `🏁 Итоговые результаты турнира #${tournamentId}\n\n`;
      const body = formatFinalResults(results);

      await bot.sendMessage(chatId, header + body, {
        reply_to_message_id: msg.message_id,
      });
    } catch (err) {
      console.error('ERROR in !итогтурнира:', err);
      await bot.sendMessage(
        chatId,
        '❌ Произошла ошибка при получении итогов турнира.',
        { reply_to_message_id: msg.message_id }
      );
    }
  });
};
