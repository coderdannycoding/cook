// One hand-drawn icon set for the whole interface (24×24 grid, 2.2px round strokes, currentColor),
// so the UI looks the same on every platform instead of depending on each OS's emoji font.

const P = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  sunset: '<path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 6.5v2.5M4.6 10.6l1.7 1.3M19.4 10.6l-1.7 1.3M8 21.5h8"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/>',
  coin: '<circle cx="12" cy="12" r="8.6"/><path d="M14.6 9.3c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.3 5.3 4.1 0 1.1-1.2 2-2.7 2-1.2 0-2.2-.5-2.7-1.4M12 6.3v1.7M12 16v1.7"/>',
  star: '<path class="f" d="M12 3.2l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z"/>',
  lamp: '<path d="M12 2.5v5M3.5 15c.7-4.4 4.1-7.5 8.5-7.5s7.8 3.1 8.5 7.5zM9.8 15a2.2 2.2 0 0 0 4.4 0M7 19.5l-1 1.6M12 20v2M17 19.5l1 1.6"/>',
  wind: '<path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h6.5"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  sound: '<path d="M4 9.2h3.8L13 5v14l-5.2-4.2H4z"/><path d="M16.3 9.2a4 4 0 0 1 0 5.6M18.9 6.5a7.6 7.6 0 0 1 0 11"/>',
  mute: '<path d="M4 9.2h3.8L13 5v14l-5.2-4.2H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>',
  play: '<path class="f" d="M7.5 4.8v14.4L19 12z"/>',
  book: '<path d="M3 5.6c2.6-1 6-.8 9 1.1 3-1.9 6.4-2.1 9-1.1v13c-2.6-1-6-.8-9 1.1-3-1.9-6.4-2.1-9-1.1zM12 6.7v13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  exit: '<path d="M14 4h5v16h-5M10.5 8l-4 4 4 4M6.5 12H16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  hammer: '<path d="M13.2 3.2l7.6 7.6-2.9 2.9-7.6-7.6zM12.3 8.9L3.9 17.3a2 2 0 0 0 2.8 2.8l8.4-8.4"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.3 14.1c2.7.3 4.7 2.6 4.7 5.9"/>',
  chevrons: '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>',
  menu: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4.5"/>',
  crate: '<path d="M3 7h18v13H3zM3 13.5h18M7.5 7v13M16.5 7v13M6 7l1.5-3h9L18 7"/>',
  knife: '<path d="M9.2 14.8L21 3c.3 5.2-2.9 10.4-8.6 15.4z"/><path d="M9.2 14.8l-5.4 5.4" stroke-width="3"/>',
  pan: '<circle cx="9.5" cy="13.5" r="6.3"/><path d="M14.3 9.2l6.5-5.7" stroke-width="2.8"/>',
  pot: '<path d="M4 10h16v7.2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 10h20M9 6.8c0-1.1 1.2-1.1 1.2-2.3M13.8 6.8c0-1.1 1.2-1.1 1.2-2.3"/>',
  fryer: '<path d="M4 9h12v8a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 17zM16 11h5M4 13.2h12M8 9v10.5M12 9v10.5"/>',
  oven: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.5M10 6.5h.5M12 18.3c-1.7 0-2.6-1.1-2.6-2.4 0-1.6 1.7-2.2 2.2-3.7.9.8 3 2 3 3.8 0 1.3-1 2.3-2.6 2.3z"/>',
  cloche: '<path d="M2.5 18h19M4.5 18a7.5 7.5 0 0 1 15 0M12 10.5V8.3M10.3 8.3h3.4"/>',
  plate: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/>',
  plant: '<path d="M7 14h10l-1.5 7h-7zM12 14V8.6"/><path d="M12 9.6c0-3.4 2.2-5.6 5.6-5.6 0 3.4-2.2 5.6-5.6 5.6zM12 11.6C12 8.8 10.2 7 7.2 7c0 2.8 1.8 4.6 4.8 4.6z"/>',
  conveyor: '<rect x="2.5" y="13" width="19" height="5.5" rx="2.75"/><path d="M6.5 15.75h.01M12 15.75h.01M17.5 15.75h.01"/><path d="M8.5 6h7v7h-7z"/>',
  roller: '<rect x="3.5" y="3.5" width="14" height="5.5" rx="1.2"/><path d="M17.5 6.2h3v5.2h-8.5v3M12 14.4v6.1"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="1.5"/><path d="M8.3 11V8.2a3.7 3.7 0 0 1 7.4 0V11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotate: '<path d="M19.6 13a7.7 7.7 0 1 1-2.2-6.3M20 3.8v4.6h-4.6"/>',
  trash: '<path d="M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>',
  hand: '<path d="M7.2 12.2V6.6a1.5 1.5 0 0 1 3 0v4.8M10.2 10.5V4.6a1.5 1.5 0 0 1 3 0v6.2M13.2 10.8V5.8a1.5 1.5 0 0 1 3 0v6.4M16.2 11.4V9a1.5 1.5 0 0 1 3 0v5.3c0 4-2.8 7-6.7 7-2.6 0-4.3-1.2-5.6-3.1l-2.6-4.4a1.5 1.5 0 0 1 2.6-1.5l.3.5"/>',
  drop: '<path d="M12 3v10.5M7.6 9.2L12 13.5l4.4-4.3M4 16.5v3.5h16v-3.5"/>',
  extinguisher: '<rect x="8" y="8.5" width="8" height="12.5" rx="2.6"/><path d="M10.5 8.5V5.5h3v3M13.5 5.5h4.5M10.5 6.5C7.5 6.5 5.5 8 5.5 11.5v3"/>',
  sponge: '<rect x="3.5" y="11.5" width="17" height="9" rx="2.2"/><path d="M3.5 15.5h17"/><circle cx="8" cy="6.5" r="2"/><circle cx="14" cy="5" r="1.4"/><circle cx="17.5" cy="8.3" r="1"/>',
  bell: '<path d="M3.5 18.5h17M5.5 18.5a6.5 6.5 0 0 1 13 0M12 12V9.6"/><circle cx="12" cy="8" r="1.6" class="f"/>',
  fire: '<path class="f" d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.2 2.1-5 3.4-7 .5 1.9 1.4 3 2.6 3.5.1-3.5 1.6-6.4 4-7.9-.3 3 1.2 4.9 2.6 6.6 1.3 1.6 2.4 3.1 2.4 5.2 0 3.6-3.4 6.2-8 6.2z"/>',
  warn: '<path d="M12 3.8L21.5 20h-19z"/><path d="M12 10v4.4M12 17.2v.3"/>',
  crown: '<path class="f" d="M3 8.2l4.3 4.1L12 5l4.7 7.3L21 8.2 19.2 19H4.8z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.6v4l2.6 2.4M9.8 3h4.4M18.6 6.6l1.4-1.4"/>',
  megaphone: '<path d="M3.5 10v4h3l9.5 5V5L6.5 10z"/><path d="M19 9.4a3.6 3.6 0 0 1 0 5.2"/>',
  bread: '<path d="M4.8 19.2c-1.6-1.6-.4-5 2.6-8l5.8-5.8c3-3 6.4-4.2 8-2.6s.4 5-2.6 8l-5.8 5.8c-3 3-6.4 4.2-8 2.6zM8.6 12l2.4 2.4M11.6 9l2.4 2.4M14.6 6l2.4 2.4"/>',
  shoe: '<path d="M3 16.5V10l3.7-.8 2-3.7h3.1l1 3.8 5.8 1.9c1.9.6 2.4 1.9 2.4 3.4v1.9zM3 16.5V19h18v-2.5M10.5 11.5l1.2-1.2M12.8 12.4l1.2-1.2"/>',
  floor: '<path d="M4 4h16v16H4zM4 10.5h6.5V20M14 4v6.5h6"/>',
  trendup: '<path d="M3 17.5l6-6 4 4 8-8M15 7.5h6v6"/>',
  trenddown: '<path d="M3 6.5l6 6 4-4 8 8M15 16.5h6v-6"/>',
  chefhat: '<path d="M7.2 14v6h9.6v-6M7.2 14a4 4 0 0 1-1.1-7.8 4.5 4.5 0 0 1 5.9-3 4.5 4.5 0 0 1 5.9 3A4 4 0 0 1 16.8 14zM7.2 17h9.6"/>',
  bowtie: '<path d="M3.5 7.5v9L10.5 12zM20.5 7.5v9L13.5 12z"/><circle cx="12" cy="12" r="1.8"/>',
  broom: '<path d="M14.5 3l-3.2 8.6M7.8 11l7.7 2.9-2.6 7.1-8.2-3zM8.5 20.3l1.5-4M11.4 21.2l1.1-3"/>',
  heart: '<path class="f" d="M12 20.3S3.3 15 3.3 9.2A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.7 2.4C20.7 15 12 20.3 12 20.3z"/>',
  joystick: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.2" class="f"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.4"/>',
  zzz: '<path d="M4 9h5l-5 6h5M13 5h4l-4 5h4M17 13h3.5L17 17.5h3.5"/>',
  question: '<path d="M8.8 9a3.3 3.3 0 1 1 4.6 3c-1 .5-1.4 1.1-1.4 2.2v.6M12 18.5v.2"/>',
  pin: '<circle cx="12" cy="9.5" r="5"/><path d="M12 14.5V21"/>',
};

const cache = {};

// Inline SVG markup for an icon; unknown names render nothing.
export function icon(name, cls = '') {
  const body = P[name];
  if (!body) return '';
  const k = `${name}|${cls}`;
  if (!cache[k]) {
    cache[k] = `<svg class="ic ic-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  return cache[k];
}

export const hasIcon = (name) => !!P[name];
export const ICON_NAMES = Object.keys(P);

// Full-colour badges for counters and headers, drawn with the same thick outline as the UI.
const L = '#1d1a2f';
const B = {
  coin: `<circle cx="16" cy="16" r="12.5" fill="#ffc62e" stroke="${L}" stroke-width="3"/><circle cx="16" cy="16" r="8" fill="none" stroke="#e8900c" stroke-width="2.6"/><path d="M10.6 11a7 7 0 0 1 6.6-3.4" fill="none" stroke="#fff6b0" stroke-width="2.6" stroke-linecap="round"/>`,
  star: `<path d="M16 3.6l3.7 7.8 8.5 1-6.2 5.9 1.6 8.4L16 22.6l-7.6 4.1 1.6-8.4-6.2-5.9 8.5-1z" fill="#ffd23f" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M12.6 12.4l1.8-3.4" stroke="#fff8c8" stroke-width="2.4" stroke-linecap="round"/>`,
  sun: `<g stroke="${L}" stroke-width="3" stroke-linecap="round"><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.5 6.5l2.8 2.8M22.7 22.7l2.8 2.8M6.5 25.5l2.8-2.8M22.7 9.3l2.8-2.8"/></g><g stroke="#ffb31a" stroke-width="1.4" stroke-linecap="round"><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.5 6.5l2.8 2.8M22.7 22.7l2.8 2.8M6.5 25.5l2.8-2.8M22.7 9.3l2.8-2.8"/></g><circle cx="16" cy="16" r="7.5" fill="#ffd23f" stroke="${L}" stroke-width="3"/>`,
  sunset: `<path d="M5 22a11 11 0 0 1 22 0z" fill="#ff9a3d" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M3 22h26" stroke="${L}" stroke-width="3" stroke-linecap="round"/><path d="M9.5 17a7 7 0 0 1 4-4" stroke="#ffe1a0" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
  moon: `<path d="M24.5 19.5A10.5 10.5 0 1 1 12.5 5.5a8.5 8.5 0 0 0 12 14z" fill="#ffe7a3" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>`,
  heart: `<path d="M16 27S4 19.6 4 11.8A6.2 6.2 0 0 1 16 9a6.2 6.2 0 0 1 12 2.8C28 19.6 16 27 16 27z" fill="#ff5a6e" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M8.6 11.4a3 3 0 0 1 2.6-2.6" stroke="#ffc2cb" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
  lock: `<path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" stroke="${L}" stroke-width="3"/><rect x="7" y="14" width="18" height="13" rx="3" fill="#ffc62e" stroke="${L}" stroke-width="3"/><circle cx="16" cy="20.5" r="2" fill="${L}"/>`,
  chef: `<circle cx="16" cy="16" r="14" fill="#ffa63d" stroke="${L}" stroke-width="3"/><path d="M10.5 20v4h11v-4M10.5 20a4 4 0 0 1-1-7.6 4.6 4.6 0 0 1 6.5-3.3 4.6 4.6 0 0 1 6.5 3.3 4 4 0 0 1-1 7.6z" fill="#fff" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`,
  trophy: `<path d="M10 5h12v6a6 6 0 0 1-12 0z" fill="#ffd23f" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><path d="M10 7H6.5a3.5 3.5 0 0 0 3.8 5M22 7h3.5a3.5 3.5 0 0 1-3.8 5M16 17v4M11 26h10l-1.5-5h-7z" fill="none" stroke="${L}" stroke-width="2.6" stroke-linejoin="round"/>`,
  // the game's mark: a pan with a sizzling egg
  logo: `<path d="M44 40l15 12" stroke="${L}" stroke-width="10" stroke-linecap="round"/><path d="M44 40l15 12" stroke="#a0522d" stroke-width="5" stroke-linecap="round"/><ellipse cx="28" cy="34" rx="25" ry="21" fill="#3a3f6e" stroke="${L}" stroke-width="4"/><ellipse cx="28" cy="31" rx="20" ry="15.5" fill="#545a99"/><path d="M15 33c-1-7 6-11 11-9 4-5 13-3 13 4 6 2 4 10-2 10-3 5-12 5-14 1-6 1-9-3-8-6z" fill="#fff" stroke="${L}" stroke-width="3" stroke-linejoin="round"/><circle cx="28" cy="31" r="6" fill="#ffb21a" stroke="${L}" stroke-width="3"/><circle cx="26" cy="29" r="1.8" fill="#fff3c0"/><path d="M14 10c-3 3 3 5 0 8M27 6c-3 3 3 5 0 8M40 10c-3 3 3 5 0 8" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`,
};
const BOX = { logo: '0 0 64 64' };

// Full-colour badge markup (counters, ribbons, the logo); unknown names render nothing.
export function badge(name, cls = '') {
  const body = B[name];
  if (!body) return '';
  return `<svg class="bdg bdg-${name}${cls ? ` ${cls}` : ''}" viewBox="${BOX[name] || '0 0 32 32'}" aria-hidden="true" focusable="false">${body}</svg>`;
}
