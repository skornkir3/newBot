// tournaments/saveMapResultsDb.js
const db = require('../handlers/db');

module.exports = async function saveMapResultsToDb(clanId, mapNo, teams) {
  if (!Array.isArray(teams) || teams.length === 0) return;

  const values = [];
  const params = [];
  let idx = 1;

  for (const team of teams) {
    const teamRank = team.rank;
    const playerNames = team.players.map(p => p.name);
    const teamKey = playerNames.join(' + ');

    const totalKills   = team.totalKills   ?? 0;
    const killsPts     = team.killsPts     ?? totalKills;
    const placementPts = team.placementPts ?? 0;
    const totalPts     = team.totalPts     ?? (killsPts + placementPts);

    values.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
    );

    params.push(
      clanId,
      mapNo,
      teamRank,
      teamKey,
      playerNames,
      totalKills,
      killsPts,
      placementPts,
      totalPts
    );
  }

  const sql = `
    INSERT INTO tournament_map_results
      (clan_id, map_no, team_rank, team_key, players, total_kills, kills_pts, placement_pts, total_pts)
    VALUES
      ${values.join(', ')}
    ON CONFLICT (clan_id, map_no, team_key)
    DO UPDATE SET
      team_rank     = EXCLUDED.team_rank,
      total_kills   = EXCLUDED.total_kills,
      kills_pts     = EXCLUDED.kills_pts,
      placement_pts = EXCLUDED.placement_pts,
      total_pts     = EXCLUDED.total_pts,
      players       = EXCLUDED.players
  `;

  await db.query(sql, params);
};
