# Contributing to DoomDungeons

Thanks for wanting to help. The game has no build step and no install step:

```bash
npm start      # http://localhost:8090
npm test
```

To play locally, put a Doom WAD in `wads/` (for example the free shareware
`wads/DOOM1.WAD`). That folder is git-ignored. Without it, the game asks you to
choose a WAD in the browser.

## Ground rules

- **Never commit id Software data.** No WADs, and no sprites, textures, sounds,
  music or maps extracted from them. Everything Doom-shaped is read at runtime
  from the player's own WAD.
- Keep it dependency-free at runtime and runnable from plain static files.
  Three.js is vendored in `vendor/three/`.
- Keep the simulation (`src/game/`) free of DOM and Three.js so it stays
  testable in Node. Rendering lives in `src/render/`, UI in `src/ui/`.
- Small focused modules, and tests for new logic (`node:test`). Tests that
  need a real WAD must skip themselves when `wads/DOOM1.WAD` is missing,
  because CI has none.

## Where things live

| Folder | What it does |
| --- | --- |
| `src/wad/` | Reads WAD lumps: maps, palette, patches, textures, flats |
| `src/world/` | Turns Doom maps into a block grid and builds the world mesh |
| `src/game/` | The simulation: Doom's monsters, weapons, items and line/sector specials |
| `src/render/` | Three.js scene, block shader, voxel sprites, camera |
| `src/audio/` | DMX sound effects and the MUS music synthesizer |
| `src/ui/` | HUD, automap, menus and intermission screens |
| `src/app/` | Game flow, input, settings and WAD loading |

## Pull requests

Describe what changed and how you tested it, and tick the checklist in the
PR template.
