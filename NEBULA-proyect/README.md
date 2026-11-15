# NEBULA — Space Mission Design Game

**NASA Space Apps Challenge · Challenge: Space Mission Design Game**

NEBULA is an interactive, offline game where you design, launch and manage a complete space mission. You choose the objectives, build the spacecraft, pick the instruments and launch vehicle, balance mass, power, communications and budget, and then fly the mission day by day, making decisions when emergencies strike. Every choice changes the outcome, and the game shows you why.

## Quick start

1. Open `nebula.html` (or `dist/nebula.html`) in Chrome, Edge or Firefox. No installation and no internet connection needed.
2. Or open this folder in Visual Studio Code and use the **Live Server** extension on `dist/nebula.html`.
3. The game is bilingual (Spanish / English). Use the language button in the top-right corner.

## How a session works

| Step | Screen | What you do |
|---|---|---|
| 1 | **Mission Control** | Pick a mission (AURORA, LUNARIS or ARES ECHO) and a mode (Solo or Twin Mission). |
| 2 | **Ship Designer** | Build the spacecraft in a live 3D view: structure, propulsion, solar arrays, batteries, antenna, computer, thermal control, instruments and launch vehicle. Warnings update in real time. |
| 3 | **Resource Manager** | Review the mass, cost and power budgets and the mission timeline. |
| 4 | **Neuron Core** | Get advice from the onboard AI assistant (see below). |
| 5 | **Orbital Lab** | Explore circular orbits, elliptical orbits and Hohmann transfers. |
| 6 | **Science Lab** | Five experiments, each with Theory, Experiment and Demo modes. |
| 7 | **Mission Simulator** | Launch, fly the mission day by day and decide what to do during emergencies. |
| 8 | **Mission Analytics** | See the score breakdown, what cost you points, planned vs. executed values and your history. |

### The three missions

| Mission | Destination | Difficulty | What makes it hard |
|---|---|---|---|
| **AURORA** | Low Earth orbit, raise 400 → 700 km | Beginner | Tight budget; learn the basic trade-offs. |
| **LUNARIS** | Lunar orbit (after trans-lunar injection) | Intermediate | Lunar orbit insertion, eclipses, communications. |
| **ARES ECHO** | Mars orbit (≈ 259-day transfer) | Expert | Large Δv, weak sunlight, 3–22 minute signal delay, four science objectives. |

**Twin Mission mode:** two ships face exactly the same random events (same seed). Any difference in the result comes from engineering alone.

## Neuron Core (the AI assistant)

Neuron Core has three levels, and the game is explicit about which one is speaking:

1. **Verified rules** — deterministic checks based on physics (for example "your Δv is below the mission requirement"). These are labelled *VERIFIED RULE*.
2. **Neural network** — a small multilayer perceptron (7 → 14 → 8 → 3) trained in your browser on about 1,200 simulated designs. It predicts score, risk and success probability. Its error is measured on held-out data and compared with a naive baseline, and it can explain which design variables drive a prediction.
3. **Learning from you** — it also learns from the missions you play (your data is weighted ×3).

It also includes a simulated-annealing **optimizer** that *recommends* design changes. It never changes your ship without your permission.

## The physics

All numbers come from first principles; nothing is hard-coded to make a mission "work":

- Circular velocity `v = √(μ/r)` (7.67 km/s at 400 km), orbital period, vis-viva equation
- Hohmann transfers (planetary and heliocentric) and capture burns
- Tsiolkovsky rocket equation, with a numerical burn check
- Eclipse fraction `asin(R/r)/π`, inverse-square solar flux, battery state of charge
- Friis link budget (X-band), data rate and light-time delay `t = d/c`
- Seeded, reproducible random events (the same seed always gives the same events)
- Mission score `S = 0.30·C + 0.20·R + 0.15·B + 0.15·E + 0.10·D + 0.10·A`
  (objectives, resource reserves, budget, energy efficiency, design quality, in-mission decisions)

The Science Lab and the Colab notebook check formulas against numerical simulations (RK4 orbit integration, step-by-step burn integration, minute-by-minute battery simulation).

## Scientific honesty (limits of the model)

NEBULA is an **educational** simulator, not a navigation tool.

- Two-body orbits only: no J2, atmospheric drag, solar radiation pressure or third-body effects.
- Chemical burns are treated as instantaneous impulses.
- No launch windows, planetary ephemerides or real launch-vehicle trajectories.
- Masses, prices and component performance are didactic approximations.
- The neural network is a learned approximation; the deterministic rules are what the game treats as verified.

## Project structure

| Path | Contents |
|---|---|
| `src/engine.js` | Engine: physics, catalog, missions, design evaluation, day-by-day simulator, events, neural network, optimizer |
| `src/ui1.js` | Global state, language, saving, starfield, 3D ship renderer, charts |
| `src/ui2.js` | Navigation, Mission Control, Ship Designer, Resource Manager |
| `src/ui3.js` | Neuron Core and Orbital Lab |
| `src/ui3b.js` | Science Lab (5 experiments) |
| `src/ui4.js` | Mission Simulator, Mission Analytics, app start-up |
| `src/style.css`, `src/template.html` | Visual design and base page |
| `build.py` | Bundles `src/` into a single `nebula.html` |
| `tests/fisica.test.js` | Physics unit tests: `node tests/fisica.test.js` (or `npm test`) |
| `tests/mltest.js`, `explore.js`, `dist.js` | Engine and ML exploration scripts (Node) |
| `tests/prueba_*.py` | Browser tests (Playwright) |
| `cuaderno/NEBULA_Fisica_Numerica.ipynb` | Google Colab notebook with every calculation and numerical demonstration (38 checks) |

### Build and test

```bash
python build.py            # rebuilds nebula.html and dist/nebula.html
node tests/fisica.test.js  # physics unit tests
```

The app is plain JavaScript, HTML5 Canvas and CSS. It has **no dependencies**.

## NASA data and resources

NEBULA does not download live data. It uses published physical constants and reference values, entered by hand from the NASA fact sheets below:

- NASA Planetary Fact Sheets (radii, gravitational parameters, orbital distances, solar flux): https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NASA Deep Space Network (reference for ground-antenna scale and deep-space communication concepts): https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/

Please review the exact values and links before submission.

## Use of Super Intelligence (SI)

This project was developed with the help of an AI assistant.

- **Code:** the application code (Front end and some logical part).
- **Text:** this README and the presentation script were written with AI.
- **Images and video:** none. All graphics are drawn by the code at run time (HTML5 Canvas).
- **NASA branding:** none used. No NASA logos, flags or mission identifiers appear in the project.

## Credits and license

Created for the NASA Space Apps Challenge. Mission names (AURORA, LUNARIS, ARES ECHO) and the game concept are original to this project.
