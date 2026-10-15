# DoomDungeons

[![CI](https://github.com/antonyisoardi/DoomDungeons/actions/workflows/ci.yml/badge.svg)](https://github.com/antonyisoardi/DoomDungeons/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Doom 1, rebuilt as a block world and played from a Minecraft Dungeons style camera.

Every map, monster, weapon, item, door, lift, switch and secret comes straight from
your own Doom WAD. The level geometry becomes chunky blocks with Doom's real textures.
Every sprite becomes a voxel model, and the original rules run underneath at 35 tics
a second: monster stats and AI, weapon damage and spread, armour, keys, crushers,
teleporters, Nightmare respawns, all of it.

## Play

```bash
npm start
```

Then open http://localhost:8090. You need Node 20 or newer for the tiny static
server; there is nothing to install.

DoomDungeons needs a Doom 1 IWAD, and none is included. Either:

- put it in `wads/` next to the game (`wads/DOOM.WAD` or `wads/DOOM1.WAD`), or
- drop it onto the game in your browser. It is remembered in your browser's
  storage and never uploaded anywhere.

The shareware `DOOM1.WAD` (Episode 1, *Knee-Deep in the Dead*) is freely
distributable and widely mirrored. A registered `DOOM.WAD` or *The Ultimate Doom*
unlocks all four episodes.

| Key | Action |
| --- | --- |
| W A S D / arrows | Move (screen-relative) |
| Mouse | Aim |
| Left mouse button | Fire |
| E, Space or right mouse button | Use: switches and doors (walking into a door opens it too) |
| 1–7, mouse wheel, Q | Change weapon |
| Shift | Walk |
| Tab | Automap |
| + / − | Zoom |
| M | Music on/off |
| Esc or P | Pause menu |

Skip the menus with `?map=E1M3&skill=4` (skill 1–5).

## How it works

- **Maps → blocks.** Each map is sampled onto a 16-unit grid. A cell takes the sector
  under most of its 16 sample points, with doors winning ties over walls and walls over
  floors, so thin doors and walls survive. Floors keep their exact heights, walls rise
  above the floors around them, and closed doors are blocks that sink as Doom's ceiling
  rises. Textures come from the nearest linedef's sidedef, as Doom would draw them.
- **One draw call for the world.** The world mesh reads each sector's live height and
  light level from a small float texture, so doors, lifts, crushers and flickering lights
  animate without rebuilding geometry. Walls between the camera and the player dissolve so
  you can always see yourself.
- **Sprites → voxels.** Every sprite frame is extruded into voxels, thickest in the
  middle of the shape, and Doom's eight rotation frames are chosen from the camera angle.
- **Doom's rules.** The simulation (`src/game/`) is a port of Doom's thinkers: A_Chase and
  P_NewChaseDir, P_CheckMissileRange, P_DamageMobj with armour classes and knockback,
  P_RadiusAttack, sound propagation through sectors, and the door, floor, platform,
  ceiling, stair, donut, light, teleport and exit specials. Hitscan keeps Doom's
  automatic vertical aim and gains a little horizontal aim assist for the top-down view.
- **Sound and music.** Sound effects are the WAD's DMX lumps with distance falloff and
  stereo panning. Music is the WAD's MUS songs played by a small Web Audio synthesizer
  standing in for the OPL chip.

## Development

```bash
npm test     # unit and simulation tests (node:test); WAD-based tests skip without wads/DOOM1.WAD
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout of `src/` and the ground rules.

## License and disclaimer

The DoomDungeons code is released under the [MIT License](LICENSE). Three.js is
vendored under its own MIT license in `vendor/three/`.

DoomDungeons is an unofficial fan project. It is not affiliated with or endorsed by
id Software, Bethesda, ZeniMax, Microsoft or Mojang. Doom is a trademark of id Software
and Minecraft Dungeons is a trademark of Mojang. This repository contains no id Software
data: maps, graphics, sounds and music are read at runtime from a WAD you supply.
