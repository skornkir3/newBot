// db/getTournamentFinalResults.js
const db = require('../handlers/db');
const getClanId = require('../clan/getClanId');
/**
 * Возвращает финальные результаты турнира:
 * [
 *   {
 *     team_no: 6,
 *     players: ['unwDVK', 'unwPominki', 'unwMonaco'],
 *     totalKills: 37,
 *     killsPts: 37,
 *     placementPts: 22,
 *     totalPts: 59
 *   },
 *   ...
 * ]
 */
async function getTournamentFinalResults(tournamentId) {
  // 1) суммируем очки по всем картам для каждой команды
  const { rows } = await db.query(
    `
    WITH sums AS (
      SELECT
        team_no,
        SUM(total_kills)   AS total_kills,
        SUM(kills_pts)     AS kills_pts,
        SUM(placement_pts) AS placement_pts,
        SUM(total_pts)     AS total_pts
      FROM tournament_results
      WHERE tournament_id = $1
      GROUP BY team_no
    )
    SELECT
      s.team_no,
      s.total_kills,
      s.kills_pts,
      s.placement_pts,
      s.total_pts,
      ARRAY_AGG(cm.nickname ORDER BY tp.actor_id) AS players
    FROM sums s
    JOIN tournament_participants tp
      ON tp.tournament_id = $1
     AND tp.team_no = s.team_no
    JOIN clan_members cm
      ON cm.actor_id = tp.actor_id
    GROUP BY
      s.team_no,
      s.total_kills,
      s.kills_pts,
      s.placement_pts,
      s.total_pts
    ORDER BY
      s.total_pts DESC,
      s.total_kills DESC,
      s.team_no ASC
    `,
    [tournamentId]
  );

  // приводим к аккуратному виду
  return rows.map(r => ({
    teamNo: r.team_no,
    players: r.players,
    totalKills: Number(r.total_kills) || 0,
    killsPts: Number(r.kills_pts) || 0,
    placementPts: Number(r.placement_pts) || 0,
    totalPts: Number(r.total_pts) || 0,
  }));
}

module.exports = getTournamentFinalResults;
