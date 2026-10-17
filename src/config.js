// Global tuning constants. Balance lives here so it can be tweaked in one place.

export const GAME_TITLE = 'Pandemonium Bistro';
export const SAVE_KEY = 'pandemonium-bistro-save-v1';
export const SETTINGS_KEY = 'pandemonium-bistro-settings-v1';

export const DAY = {
  length: 240,            // real seconds from opening to closing time
  openHour: 10,
  closeHour: 22,
  lastSeatingHour: 21,
  forceLeaveHour: 22.6,   // stragglers are shooed out at this point
};

export const FLOOR_LEVELS = [
  { w: 12, h: 9 },
  { w: 14, h: 10 },
  { w: 16, h: 11 },
  { w: 18, h: 12 },
];

export const WALL_HEIGHT = 2.7;
export const FRONT_WALL_HEIGHT = 0.55;
export const SURFACE_Y = 0.96;

export const PLAYER = {
  speed: 4.4,
  accel: 42,
  friction: 30,
  radius: 0.3,
  dashSpeed: 13.5,
  dashTime: 0.15,
  dashCooldown: 1.1,
  reach: 0.78,
};

export const COOK = {
  burnWindow: 7,        // seconds a finished dish survives on the heat before burning
  igniteDelay: 2.6,     // seconds a burnt item smoulders before fire breaks out
  spreadInterval: 5.5,  // seconds between fire spread attempts
  fireGrowth: 0.4,
  extinguishRate: 1.7,
  washTime: 2.2,
};

export const START = {
  cash: 150,
  rating: 1.0,
};

export const ECON = {
  rentBase: 15,
  rentPerLevel: 15,
  sellRefund: 0.75,
};

export const CAMERA = {
  yaw: Math.PI / 4,
  elevation: 0.92,      // radians (~53 degrees) - steeper than classic iso for readability
  distance: 40,
  dayView: 12.5,
  minView: 7,
  maxView: 22,
};

export const LIGHT_POOL_SIZE = 10;
