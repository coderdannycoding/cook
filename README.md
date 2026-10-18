# Sizzle Shack

An isometric restaurant game that runs in the browser. During service you cook every order by
hand, in the spirit of *Overcooked!*. After closing you rearrange the kitchen like in *PlateUp!*
and grow the business like in *Restaurant Tycoon 3*.

Built with **Three.js** (vendored, no bundler needed) and the **Web Audio API**. Every model,
texture, particle and sound is generated procedurally at runtime, with no asset files.

## Deploy it to the web (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcoderdannycoding%2Fcook&project-name=sizzle-shack&repository-name=sizzle-shack)

The repo is ready to import as-is. There are no dependencies to install and no settings to change:

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. Leave every setting at its default. *Framework Preset* shows **Other**, and `vercel.json`
   already provides the build command (`npm run build`) and output directory (`public`).
3. Click **Deploy**. About 20 seconds later the game is live at `https://<project>.vercel.app`.

Every push to the production branch redeploys automatically, and every other branch or pull
request gets its own preview URL. To use your own domain, open the project and go to
**Settings → Domains**.

What the build does: `scripts/build.mjs` copies `index.html`, `src/`, `styles/` and `vendor/`
into `public/`. It fails the deploy if any file referenced from HTML, a JS import or a CSS
`url()` is missing, then stamps the version and commit into `<meta name="version">`.
`vercel.json` also adds a strict Content-Security-Policy and other security headers, plus
long-lived caching for the versioned Three.js file.

The CSP blocks third-party scripts, including the Vercel Toolbar that Vercel can inject into
preview deployments, so the toolbar won't show on previews. Production is unaffected. To turn it
back on, add the sources from
[Vercel's toolbar CSP docs](https://vercel.com/docs/vercel-toolbar/managing-toolbar) to the
`Content-Security-Policy` header in `vercel.json`.

The same `public/` folder works on any static host. Netlify and Cloudflare Pages take build
command `npm run build` and output directory `public`. GitHub Pages has no build step: either
publish the branch root as it is (every path is relative, so the unbuilt source runs fine), or add
an Actions workflow that runs `npm run build` and uploads `public/`.

### Single-file build (itch.io, offline)

```bash
npm run build:single    # → dist/sizzle-shack.html, everything inlined (about 1 MB)
```

This bundles the JS with esbuild (fetched on demand through `npx`) and inlines all CSS and
fonts, so the game runs from one HTML file. It even opens straight from disk with a double-click.
For itch.io, rename it to `index.html`, zip it and upload it as an HTML game. The single file uses
inline scripts, so don't serve it with this repo's `vercel.json` headers: the Vercel deploy uses
the multi-file `public/` build instead.

## Run it locally

ES modules need to be served over HTTP (opening `index.html` from disk won't work):

```bash
npm start               # zero-dependency static server → http://localhost:8080
npm run preview         # production build in public/, served with the same headers as Vercel
```

To try it on your phone, start the server with `npm start -- --lan` and open your computer's
local IP address on port 8080 from the phone (same Wi-Fi network).

Requires Node 18 or newer. Any browser with WebGL 2 works on desktop or mobile: Chrome, Edge,
Firefox, and Safari 15 or later. Gamepads also work.

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

**On phones and tablets** (detected automatically, best played in landscape):

| Action | Touch |
| --- | --- |
| Move | virtual joystick (left thumb, anywhere on the lower left) |
| Grab / drop / serve | **Grab** button (its label shows what it will do) |
| Chop · wash · spray | **Use** button (tap once and it keeps working while you stand still) |
| Dash | **Dash** button |
| Camera (night) | drag to pan · pinch to zoom |
| Build mode | tap a card, tap the floor to preview, tap again or press **Place here** · tap a placed item to move it · the toolbar rotates, sells and cancels |

## How to play

**Service (4 minutes, 10 AM to 10 PM).** Guests walk in from the street, take a seat and order.
The order cards along the top show each dish, its ingredients and how to prepare each one (chop,
sear, boil, fry or bake), plus a patience bar that runs from green through yellow to red.

1. Grab ingredients from crates. Each one costs a little money.
2. Chop or knead on cutting boards, then cook on the right station. Food left on the heat
   **burns**, then **catches fire**, and fire spreads to neighbouring stations. Grab the
   extinguisher and hold `F`, then bin the burnt food before it re-ignites.
3. Take a clean plate, scoop each prepared part onto it, carry it to the table and press `E`.
4. Guests eat, pay and tip based on speed and ambience. Clear their dirty plates, wash them in
   the sink, and walk past tables to pocket the cash.
5. **Food critics** wear a gold crown and have little patience. Serve them quickly for a large cash
   bonus and a big rating boost.

**After closing.** The results screen shows how the day went and what you earned and spent. Then use the menu at the bottom:

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

Décor raises **ambience**, which gives more patience and bigger tips. Mood lamps calm nearby
guests, and booths make guests more patient still. Progress autosaves to `localStorage` every night.

## Architecture

```
index.html            HTML shell (loads src/main.js as an ES module; no build step needed to run it)
styles/               main.css (design tokens, buttons, title, modals) · hud.css (counters, order cards, overlays)
                      panels.css (night menu, shop tiles, results screen) · touch.css (touch controls, phone layouts)
                      fonts.css (self-hosted Lilita One and Nunito)
vendor/               three-0.169.0.module.min.js · fonts/ (SIL Open Font License)
scripts/              build.mjs (static build → public/) · build-single.mjs (one-file build → dist/)
vercel.json           Vercel build settings, security headers and caching
serve.mjs             Local static server that applies the same headers as vercel.json
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
  icons.js            The interface's single SVG icon set (no emoji, so it looks the same on every device)
  boot-guard.js       Tiny classic script that shows an error if a game file fails to download
  tutorial.js         Day-one guided tutorial with a 3D pointer
  input.js            Keyboard, mouse, touch (pointer events: taps, drags, pinches) & gamepad
  touch.js            On-screen joystick and action buttons for touch devices
  state.js            Save/load (localStorage) and settings
```

Debugging hook: `window.__game` exposes the running game instance in the browser console.

Three.js is MIT-licensed (see `vendor/THREE-LICENSE`). The Lilita One and Nunito fonts are licensed
under the SIL Open Font License (see `vendor/fonts/OFL.txt`).
