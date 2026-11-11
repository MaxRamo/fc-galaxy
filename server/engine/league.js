'use strict';

const TEAMS = 12;
const PRIZE_MONEY = [4000000, 2800000, 2200000, 1800000, 1500000, 1300000, 1150000, 1000000, 900000, 800000, 700000, 600000];

function buildFixtures(clubIds, rng) {
  const teams = rng.shuffle(clubIds.slice());
  const n = teams.length;
  const rounds = [];
  const arr = teams.slice();
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i], away = arr[n - 1 - i];
      round.push(r % 2 === 0 ? { home, away, played: false, score: null } : { home: away, away: home, played: false, score: null });
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }
  const second = rounds.map(round => round.map(m => ({ home: m.away, away: m.home, played: false, score: null })));
  return rounds.concat(second);
}

function computeTable(state) {
  const clubs = state.league.clubIds;
  const table = clubs.map(id => ({
    clubId: id, name: state.clubs[id].name, shortName: state.clubs[id].shortName,
    played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
  }));
  const byId = Object.fromEntries(table.map(t => [t.clubId, t]));
  for (const round of state.league.fixtures) {
    for (const m of round) {
      if (!m.played || m.score == null) continue;
      const h = byId[m.home], a = byId[m.away];
      if (!h || !a) continue;
      h.played++; a.played++;
      h.gf += m.score[0]; h.ga += m.score[1];
      a.gf += m.score[1]; a.ga += m.score[0];
      if (m.score[0] > m.score[1]) { h.w++; h.pts += 3; a.l++; }
      else if (m.score[0] < m.score[1]) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }
  for (const row of table) row.gd = row.gf - row.ga;
  table.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  return table;
}

function currentRoundFixtures(state) {
  return state.league.fixtures[state.league.round] || [];
}

function allRoundMatchesPlayed(state) {
  return currentRoundFixtures(state).every(m => m.played);
}

module.exports = { TEAMS, PRIZE_MONEY, buildFixtures, computeTable, currentRoundFixtures, allRoundMatchesPlayed };
