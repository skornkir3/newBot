const db = require('../handlers/db');
const getClanId = require('../clan/getClanId');
// ======================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ======================

// нормализация ника
function normNick(s = '') {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, '');
}

// расстояние Левенштейна
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// коэффициент похожести
function similarity(a, b) {
  const na = normNick(a);
  const nb = normNick(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;

  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// найти лучшего участника по нику
function findBestParticipant(playerName, participants, threshold = 0.6) {
  let best = null;
  let bestScore = 0;

  for (const p of participants) {
    const score = similarity(playerName, p.nickname);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (bestScore < threshold) return null;

  return { ...best, score: bestScore };
}


// ======================
//  ГЛАВНАЯ ФУНКЦИЯ МОДУЛЯ
// ======================
async function saveTournamentMapResults(tournamentId, mapNo, teamsJson) {
  console.log('saveMapResults');
  console.log(tournamentId);
  console.log(mapNo);
  // 1. Загружаем участников
  try{
  const res = await db.query(
    `
      SELECT p.actor_id,
             p.team_no,
             cm.nickname
      FROM tournament_participants p
      JOIN clan_members cm
        ON cm.actor_id = p.actor_id
      WHERE p.tournament_id = $1
    `,
    [tournamentId]
  );

  const participants = res.rows;
  console.log('teamsJson');
  console.log(participants);
 // console.log(teamsJson);
  // 2. Обрабатываем результаты
  for (const team of teamsJson) {
    const {
      place,
      players,
      totalKills,
      killsPts,
      placementPts,
      totalPts
    } = team;

    let matchedParticipant = null;

    // ищем хоть одного совпавшего игрока внутри команды
    for (const pl of players) {
      const match = findBestParticipant(pl.name, participants);
      if (match) {
        matchedParticipant = match;
        console.log(matchedParticipant);
        break;
      }
    }

    if (!matchedParticipant) {
      console.warn(
        '❗ Не найдено совпадений ни по одному нику:',
        players.map(p => p.name).join(', ')
      );
      continue;
    }

    const teamNo = matchedParticipant.team_no;
  

    // 3. Сохраняем / обновляем запись в таблице
    await db.query(
      `
        INSERT INTO tournament_results
          (tournament_id, map_no, team_no,
           place, total_kills, kills_pts, placement_pts, total_pts)
        VALUES
          ($1, $2, $3,
           $4, $5, $6, $7, $8)
        ON CONFLICT (tournament_id, map_no, team_no)
        DO UPDATE SET
          place         = EXCLUDED.place,
          total_kills   = EXCLUDED.total_kills,
          kills_pts     = tournament_results.kills_pts   + EXCLUDED.kills_pts,
          placement_pts = EXCLUDED.placement_pts,
          total_pts     = EXCLUDED.total_pts
      `,
      [
        tournamentId,
        mapNo,
        teamNo,
        place,
        totalKills,
        killsPts,
        placementPts,
        totalPts
      ]
    );
  }
    }
    catch(e){
      console.log(e);
    }
}

module.exports = saveTournamentMapResults;
