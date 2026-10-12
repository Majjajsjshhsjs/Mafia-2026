const ROLES = {
  MAFIA: { id: 'MAFIA', name: 'Мафия', icon: '🔪', team: 'mafia', description: 'Убивай ночью.', nightAction: 'kill', priority: 1 },
  DON: { id: 'DON', name: 'Дон', icon: '🎩', team: 'mafia', description: 'Глава мафии.', nightAction: 'kill', priority: 0 },
  COMMISSAR: { id: 'COMMISSAR', name: 'Комиссар', icon: '🕵️', team: 'town', description: 'Проверяй ночью.', nightAction: 'check', priority: 2 },
  DOCTOR: { id: 'DOCTOR', name: 'Доктор', icon: '🩺', team: 'town', description: 'Лечи ночью.', nightAction: 'heal', priority: 2 },
  LOVER: { id: 'LOVER', name: 'Любовница', icon: '💋', team: 'town', description: 'Блокируй.', nightAction: 'block', priority: 3 },
  JOURNALIST: { id: 'JOURNALIST', name: 'Журналист', icon: '📰', team: 'town', description: 'Сравнивай.', nightAction: 'compare', priority: 3 },
  SERGEANT: { id: 'SERGEANT', name: 'Сержант', icon: '🎖️', team: 'town', description: 'Замена комиссара.', nightAction: null, priority: 5 },
  CIVILIAN: { id: 'CIVILIAN', name: 'Мирный житель', icon: '🧑', team: 'town', description: 'Спи ночью.', nightAction: null, priority: 5 }
};

const BALANCE = {
  4:  { mafia: 1, town: ['COMMISSAR', 'DOCTOR', 'CIVILIAN'] },
  5:  { mafia: 1, town: ['COMMISSAR', 'DOCTOR', 'CIVILIAN', 'CIVILIAN'] },
  6:  { mafia: 2, town: ['COMMISSAR', 'DOCTOR', 'CIVILIAN', 'CIVILIAN'] },
  7:  { mafia: 2, town: ['COMMISSAR', 'DOCTOR', 'LOVER', 'CIVILIAN', 'CIVILIAN'] },
  8:  { mafia: 2, town: ['COMMISSAR', 'DOCTOR', 'LOVER', 'JOURNALIST', 'CIVILIAN', 'CIVILIAN'] },
  9:  { mafia: 3, town: ['COMMISSAR', 'DOCTOR', 'LOVER', 'JOURNALIST', 'CIVILIAN', 'CIVILIAN'] },
  10: { mafia: 3, town: ['COMMISSAR', 'DOCTOR', 'LOVER', 'JOURNALIST', 'SERGEANT', 'CIVILIAN', 'CIVILIAN'] },
  12: { mafia: 4, town: ['COMMISSAR', 'DOCTOR', 'LOVER', 'JOURNALIST', 'SERGEANT', 'CIVILIAN', 'CIVILIAN', 'CIVILIAN'] }
};

function generateRoles(count) {
  const cfg = BALANCE[count] || BALANCE[Math.max(4, Math.min(12, count))];
  const roles = [];
  for (let i = 0; i < cfg.mafia; i++) roles.push(i === 0 ? 'DON' : 'MAFIA');
  cfg.town.forEach(r => roles.push(r));
  while (roles.length < count) roles.push('CIVILIAN');
  return shuffle(roles).slice(0, count);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { ROLES, generateRoles, shuffle };
