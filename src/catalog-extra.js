// Extra buildable décor (floor and wall pieces), registered by catalog.js. Entries are
// [id, definition] using the same fields as catalog.js add().
//
// Wall pieces: layer 'wall', cat 'wall', size [cells along the wall, 1]. They hang on the back wall
// (rot 0) or the left wall (rot 1), never block walking and only clash with other wall pieces.
// mount: height of the piece's lowest point above the floor. deep: sticks out far enough that it
// can't share the corner with another deep piece on the other wall.

const W = (o) => ({ cat: 'wall', layer: 'wall', solid: false, ...o });

export const EXTRA_ITEMS = [
  // --- Wall decor ---------------------------------------------------------------
  ['bunting', W({ name: 'Party Bunting', price: 25, decor: 2, size: [3, 1], mount: 1.95, desc: 'Bright paper flags strung along the wall.' })],
  ['macrame', W({ name: 'Macramé Hanging', price: 35, decor: 3, mount: 1.4, desc: 'Knotted cotton on a driftwood stick. Very cosy.' })],
  ['art_poster', W({ name: 'Retro Food Poster', price: 40, decor: 3, mount: 1.38, desc: 'A sunburst burger poster in a black frame.' })],
  ['sconce', W({ name: 'Twin Sconce', price: 45, decor: 3, mount: 1.45, light: true, flammable: false, deep: true, desc: 'Brass arms with two warm glowing globes.' })],
  ['art_abstract', W({ name: 'Boho Shapes', price: 55, decor: 4, mount: 1.36, desc: 'Arches and suns in earthy tones.' })],
  ['mirror', W({ name: 'Sunburst Mirror', price: 60, decor: 4, mount: 1.45, flammable: false, desc: 'A round mirror with golden rays.' })],
  ['stringlights', W({ name: 'Festoon Lights', price: 65, decor: 5, size: [3, 1], mount: 1.98, light: true, flammable: false, desc: 'Warm bulbs swagged along the wall. They twinkle.' })],
  ['plantshelf', W({ name: 'Trailing Plant Shelf', price: 70, decor: 5, size: [2, 1], mount: 1.32, deep: true, desc: 'Pothos and ivy spilling over a floating shelf.' })],
  ['menuboard', W({ name: 'Menu Chalkboard', price: 70, decor: 4, size: [2, 1], mount: 1.38, desc: 'Hand-lettered menu with little doodles.' })],
  ['art_cat', W({ name: 'Duke Whiskers', price: 75, decor: 5, mount: 1.38, desc: 'An oil portrait of a very important cat.' })],
  ['platewall', W({ name: 'Plate Wall', price: 80, decor: 5, size: [2, 1], mount: 1.36, flammable: false, desc: 'A cluster of painted plates from flea markets.' })],
  ['fishtrophy', W({ name: 'Trophy Bass', price: 85, decor: 5, mount: 1.5, deep: true, desc: 'A mounted fish that flaps now and then.' })],
  ['openshelf', W({ name: 'Pantry Shelves', price: 90, decor: 6, size: [2, 1], mount: 1.34, deep: true, desc: 'Open shelves of jars, cookbooks and copper pans.' })],
  ['cuckoo', W({ name: 'Cuckoo Clock', price: 95, decor: 6, mount: 1.32, deep: true, desc: 'A carved chalet clock. The bird pops out on the hour.' })],
  ['neon_pizza', W({ name: 'Neon Pizza', price: 100, decor: 6, mount: 1.5, light: true, flammable: false, desc: 'A glowing slice with pepperoni.' })],
  ['neon_coffee', W({ name: 'Neon Coffee', price: 100, decor: 6, mount: 1.5, light: true, flammable: false, desc: 'A steaming neon cup for the coffee crowd.' })],
  ['art_hills', W({ name: 'Lavender Fields', price: 110, decor: 7, size: [2, 1], mount: 1.4, desc: 'A sunny landscape in a gilded frame.' })],
  ['windowbox', W({ name: 'Shuttered Window', price: 120, decor: 7, size: [2, 1], mount: 1.3, deep: true, desc: 'A sunny painted view with a flower box below.' })],
  ['goldrecord', W({ name: 'Gold Record', price: 130, decor: 7, mount: 1.42, stars: 2, flammable: false, desc: 'Your first hit, framed. Glints in the light.' })],
  ['neon_yum', W({ name: 'Neon YUM', price: 150, decor: 8, size: [2, 1], mount: 1.55, light: true, flammable: false, stars: 2, desc: 'Big pink letters that buzz and flicker.' })],
  ['greenwall', W({ name: 'Living Wall', price: 160, decor: 9, size: [2, 1], mount: 1.3, deep: true, stars: 2.2, perk: { patience: 0.03 }, desc: 'A lush panel of moss and ferns. Calming to sit near.' })],

  // --- Floor decor --------------------------------------------------------------
  ['pampas', { name: 'Pampas Vase', cat: 'decor', price: 35, decor: 3, desc: 'Fluffy plumes in a tall clay vase.' }],
  ['beanbags', { name: 'Bean Bags', cat: 'decor', price: 60, decor: 4, size: [2, 1], desc: 'Two squashy bean bags. Everyone wants one.' }],
  ['monstera', { name: 'Monstera', cat: 'decor', price: 65, decor: 5, desc: 'Big split leaves on a mid-century stand.' }],
  ['velvetrope', { name: 'Velvet Rope', cat: 'decor', price: 70, decor: 4, size: [2, 1], flammable: false, desc: 'Brass posts and a red rope. Very VIP.' }],
  ['tiki', { name: 'Tiki Torch', cat: 'decor', price: 80, decor: 5, light: true, desc: 'A carved post with a flickering flame.' }],
  ['topiary', { name: 'Topiary Bunny', cat: 'decor', price: 85, decor: 6, desc: 'A hedge clipped into a hopping bunny.' }],
  ['rockinghorse', { name: 'Rocking Horse', cat: 'decor', price: 90, decor: 5, desc: 'A dappled wooden horse that rocks gently.' }],
  ['birdparadise', { name: 'Bird of Paradise', cat: 'decor', price: 95, decor: 6, desc: 'Tall paddle leaves and orange crane flowers.' }],
  ['bamboo', { name: 'Bamboo Screen', cat: 'decor', price: 100, decor: 6, size: [2, 1], desc: 'A folding screen of bamboo and woven cane.' }],
  ['fiddlefig', { name: 'Fiddle-Leaf Fig', cat: 'decor', price: 110, decor: 7, desc: 'A tall fig with big glossy leaves in a basket.' }],
  ['twinkletree', { name: 'Twinkle Tree', cat: 'decor', price: 120, decor: 7, light: true, desc: 'A little tree wrapped in twinkling lights.' }],
  ['teddy', { name: 'Giant Teddy', cat: 'decor', price: 140, decor: 8, desc: 'A huge, huggable bear with a red bow.' }],
  ['eggchair', { name: 'Egg Chair', cat: 'decor', price: 150, decor: 8, desc: 'A hanging rattan chair that sways a little.' }],

  // --- Showpieces ---------------------------------------------------------------
  ['clawmachine', { name: 'Claw Machine', cat: 'show', price: 190, decor: 10, stars: 1.5, light: true, flammable: false, perk: { arrivals: 0.03 }, desc: 'Win a plushie! Kids drag their families in.' }],
  ['recordplayer', { name: 'Record Player', cat: 'show', price: 210, decor: 10, stars: 1.8, perk: { tips: 0.03 }, desc: 'Vinyl spinning on a walnut cabinet. Good tunes, good tips.' }],
  ['photobooth', { name: 'Photo Booth', cat: 'show', price: 240, decor: 11, stars: 2, light: true, perk: { review: 0.05 }, desc: 'Guests post their photo strips and rave about you.' }],
  ['bobacart', { name: 'Boba Cart', cat: 'show', price: 260, decor: 12, size: [2, 1], stars: 2.2, perk: { arrivals: 0.04 }, desc: 'Giant bubble tea under a striped awning.' }],
  ['koipond', { name: 'Koi Pond', cat: 'show', price: 420, decor: 20, size: [2, 2], stars: 2.8, flammable: false, perk: { patience: 0.05 }, desc: 'Koi glide under lily pads. Waiting feels peaceful.' }],
  ['dino', { name: 'Dino Skeleton', cat: 'show', price: 580, decor: 24, size: [2, 2], stars: 3.5, flammable: false, perk: { arrivals: 0.05 }, desc: 'A towering fossil. Whole school trips stop by.' }],
];
