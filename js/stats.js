// Basit localStorage tabanlı istatistik yönetimi. Her mod için ayrı skor tutar.

const STATS_KEY = 'bleachdle-stats-v1';

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
  } catch { return {}; }
}

function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function getModeStats(mode) {
  const s = loadStats();
  return s[mode] || { streak: 0, maxStreak: 0, played: 0, wins: 0, guessSum: 0 };
}

function recordGame(mode, won, guesses) {
  const all = loadStats();
  const m = all[mode] || { streak: 0, maxStreak: 0, played: 0, wins: 0, guessSum: 0 };
  m.played += 1;
  if (won) {
    m.wins += 1;
    m.streak += 1;
    m.guessSum += guesses;
    if (m.streak > m.maxStreak) m.maxStreak = m.streak;
  } else {
    m.streak = 0;
  }
  all[mode] = m;
  saveStats(all);
  return m;
}

function aggregateStats() {
  const s = loadStats();
  const agg = { streak: 0, maxStreak: 0, played: 0, wins: 0 };
  for (const k of Object.keys(s)) {
    agg.streak = Math.max(agg.streak, s[k].streak);
    agg.maxStreak = Math.max(agg.maxStreak, s[k].maxStreak);
    agg.played += s[k].played;
    agg.wins += s[k].wins;
  }
  return agg;
}

function renderStatsSummary(el) {
  if (!el) return;
  const a = aggregateStats();
  const rate = a.played ? Math.round((a.wins / a.played) * 100) : 0;
  el.querySelector('[data-stat="streak"]').textContent = a.streak;
  el.querySelector('[data-stat="maxStreak"]').textContent = a.maxStreak;
  el.querySelector('[data-stat="played"]').textContent = a.played;
  el.querySelector('[data-stat="winRate"]').textContent = rate + '%';
}
