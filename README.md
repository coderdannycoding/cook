# 🍳 Pandemonium Bistro

A frantic isometric **kitchen-chaos restaurant tycoon** that runs in the browser.
Cook with your hands like *Overcooked!*, design an efficient kitchen like *PlateUp!*,
and grow a restaurant empire like *Restaurant Tycoon 3*.

Built with **Three.js** (vendored, no build step) and the **Web Audio API**. Every model,
texture, particle and sound is generated procedurally at runtime, with no asset files.

## Run it

ES modules need to be served over HTTP (opening `index.html` from disk won't work):

```bash
node serve.mjs          # zero-dependency static server → http://localhost:8080
# or: npm start  /  python3 -m http.server 8080
```

A desktop browser with WebGL 2 is recommended. Gamepads also work.

## Controls

| Action | Keys |
| --- | --- |
| Move | `WASD` / arrow keys / left stick |
| Dash | `Shift` or `Space` |
| Pick up / drop / serve | `E` or left-click |
| Chop · wash · spray extinguisher | `F` or right-click (press once and it keeps working while you stand still) |
| Pause / settings | `Esc` |
| Zoom | mouse wheel |
| Build mode (night) | click to place · `R` rotate · click a placed item to move it · right-click or `X` to sell · `WASD` pans |

## How to play

**☀️ Day shift (4 minutes, 10 AM to 10 PM).** Customers walk in from the street, take a seat and
order. Tickets across the top show each dish, its ingredients and the steps (🔪 chop, 🍳 sear,
♨️ boil, 🫧 fry, 🔥 bake), plus a patience bar that runs from green through yellow to pulsing red.

1. Grab ingredients from crates. Each one costs a little money.
2. Chop or knead on cutting boards, then cook on the right station. Food left on the heat
   **burns**, then **catches fire**, and fire spreads to neighbouring stations. Grab the
   extinguisher and hold `F`, then bin the burnt food before it re-ignites.
3. Take a clean plate, scoop each prepared part onto it, carry it to the table and press `E`.
4. Guests eat, pay and tip based on speed and ambience. Clear their dirty plates, wash them in
   the sink, and walk past tables to pocket the cash.
5. 👑 **Food critics** have a gold aura and little patience. Wow them for a large cash bonus and
   a big rating boost.

**🌙 Night phase.** Review the day's profit and loss, then use the dock:

- **Build:** buy, place, rotate, move and sell stations, tables, décor and automation on the grid.
  Placement is validated so a layout can never wall off a station, seat or the door.
- **Staff:** hire and level up Sous-Chefs, Waiters and Dishwashers (they use A* pathfinding):
  - Sous-chefs prep and cook what open orders need, rescue food before it burns and fight fires.
    At level 3 they also plate full dishes onto the Serving Pass.
  - Waiters deliver dishes from the Pass, clear tables and collect cash.
  - Dishwashers wash plates and restock the racks.
- **Upgrades:** turbo sneakers (dash), sharper knives, faster burners, smart timers, fireproof
  stoves, more plates, marketing (capacity), patience, and a bigger floor.
- **Menu:** reach star thresholds to unlock cuisines (Diner → Pizzeria → Japanese → Taqueria →
  Fry Shack → Patisserie), then toggle dishes on or off. A dish only appears on the menu if
  your layout has every crate and station it needs.

Décor raises **✨ Ambience**, which gives more patience and bigger tips. Mood lamps calm nearby
guests, and booths make guests more patient still. Progress autosaves to `localStorage` every night.

## Architecture

```
index.html            HTML shell + import map (three → vendor/three.module.min.js)
styles/               main.css (base, title, modals) · hud.css (HUD, tickets, overlays) · panels.css (night dock)
src/
  main.js             Game bootstrap, phase machine (title → countdown → day → summary → night), economy, main loop
  config.js           Tuning constants (day length, player physics, cooking/fire timings, camera)
  recipes.js          Ingredients, cook rules, dishes & cuisines, item factories, plate/topping/dish matching, production chains
  catalog.js          Buildable catalog, starter layout, upgrades, staff types & levels, floor/wall themes
  renderer.js         Three.js renderer: iso ortho camera, shadows, day/night sky, pooled point lights, room shell, street, thumbnail baker
  models.js           Procedural meshes: characters, appliances, furniture, décor, every food state, plates, street props; static mesh merging
  textures.js         Procedural canvas textures (floors, wallpapers, gingham, rug, signage, road)
  particles.js        GPU point sprites (steam, smoke, fire, foam, dust, sparks), instanced chunks (crumbs, confetti, coins), DOM floaters
  audio.js            Web Audio synth: all SFX, ambient loops (sizzle, fryer, boil, fire, spray), alarm, procedural music sequencer
  grid.js             Placement grid, rotation/footprints, occupancy, circle collision, reachability validation, serialization
  stations.js         Station behaviours (counter, board, cookers, crates, racks, sink, trash, conveyor, grabber, tables…) + fire system
  interactions.js     Single source of truth for take/put/merge/work rules shared by player, staff, conveyors and grabbers
  entities.js         Characters with procedural animation (bob, squash & stretch, floating hands, blinking, moods): Player, Customer, Staff
  ai.js               A* pathfinding with string pulling, order demand analysis, generator-based staff brains
  customers.js        Arrivals, queue, seating, ordering & patience, eating, paying & tipping, reviews, critics, passers-by
  staff.js            Hiring, firing, levelling and daily wages
  orders.js           Order tickets
  build.js            Night build mode (ghost previews, validation, move, sell)
  ui.js               HUD, tickets, world-anchored bubbles & progress bars, prompts, toasts, dock panels, modals
  tutorial.js         Day-one guided tutorial with a 3D pointer
  input.js            Keyboard, mouse & gamepad
  state.js            Save/load (localStorage) and settings
```

Debugging hook: `window.__game` exposes the running game instance in the browser console.

Three.js is MIT-licensed. See `vendor/THREE-LICENSE`.
