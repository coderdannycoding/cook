// Persistent game state + localStorage save / load.

import { SAVE_KEY, SETTINGS_KEY, START } from './config.js';
import { STARTER_LAYOUT } from './catalog.js';

export function newGameState() {
  return {
    v: 1,
    name: 'Pandemonium Bistro',
    day: 1,
    cash: START.cash,
    rating: START.rating,
    floorTheme: 'wood',
    wallTheme: 'cream',
    ownedThemes: ['floor:wood', 'wall:cream'],
    cuisines: { diner: true },
    menuOff: {},
    upgrades: { dash: 0, speed: 0, knives: 0, burners: 0, timer: 0, fireproof: 0, plates: 0, capacity: 0, patience: 0, floor: 0 },
    objects: STARTER_LAYOUT.map((o) => ({ ...o })),
    staff: [],
    storage: {},
    stats: { totalServed: 0, totalEarned: 0, bestDay: 0, criticsWowed: 0, daysPlayed: 0 },
    settings: { tutorialDone: false },
  };
}

function migrate(s) {
  const d = newGameState();
  return {
    ...d,
    ...s,
    upgrades: { ...d.upgrades, ...(s.upgrades || {}) },
    stats: { ...d.stats, ...(s.stats || {}) },
    settings: { ...d.settings, ...(s.settings || {}) },
    cuisines: { ...d.cuisines, ...(s.cuisines || {}) },
  };
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.objects)) return null;
    return migrate(s);
  } catch {
    return null;
  }
}

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { color: '#c8442b', muted: false, volume: { master: 0.8, sfx: 0.9, music: 0.55 }, ...s };
  } catch {
    return { color: '#c8442b', muted: false, volume: { master: 0.8, sfx: 0.9, music: 0.55 } };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}
