# Structure to Model (Blockbench Plugin)

Import a Minecraft structure file (`.nbt`) into Blockbench and convert it into an editable model.

## Features

- Imports Minecraft structure NBT files from Blockbench (`Tools > STM: Import Structure`)
- Resolves blockstates (`variants` and `multipart`) using block properties from the structure palette
- Resolves model parent chains and texture references (`#texture_var`)
- Applies blockstate `x`/`y` rotation to model elements and faces
- Performs neighbor-aware face culling to reduce hidden geometry
- Caches loaded textures/models for faster imports
- Configurable world-to-model scale (default `16`)

## Requirements

- Blockbench Desktop (the plugin is registered as desktop-only)
- Minecraft assets folder arranged by namespace, for example:
  - `<asset_root>/minecraft/blockstates/...`
  - `<asset_root>/minecraft/models/...`
  - `<asset_root>/minecraft/textures/...`

`asset_root` should be the folder that contains namespace folders (`minecraft`, mod namespaces, etc.), not the `textures` folder itself.

## Install / Build (Development)

Install dependencies:

```bash
bun install
```

Build the plugin bundle:

```bash
bun run build
```

Development build with inline sourcemap:

```bash
bun run build:dev
```

Output file:

- `dist/structure_to_model.js`

## Using the Plugin in Blockbench

1. Load/install the built plugin file (`dist/structure_to_model.js`) in Blockbench.
2. Open `Tools > STM: Settings`.
3. Set:
   - **Asset Root**: your Minecraft assets root folder
   - **Scale**: coordinate divisor (default `16`)
4. Open `Tools > STM: Import Structure` and select a `.nbt` structure file.
5. Wait for import to complete. The plugin creates a root group named after the structure file.

During import, the plugin shows progress and a final block count + structure size message.

## Scale Behavior

The plugin converts block coordinates and voxel-local coordinates with:

`(block_pos * 16 + local_voxel_pos) / scale`

Common values:

- `16`: 16 blocks span 1 model unit
- `1`: one Minecraft voxel unit maps directly to model coordinates

## Current Limitations / Notes

- Missing blockstate/model/texture files are skipped silently for that part of geometry
- For weighted blockstate entries, only the first candidate is used
- Transparent-block culling exceptions are currently hardcoded for glass/glass panes
- A rotation correction whitelist is currently applied to buttons and levers for specific x-rotation cases
- No biome/entity/tile-entity data import (geometry only)

## Troubleshooting

- **"Asset Root Not Set"**: configure `Tools > STM: Settings` first.
- **Blocks missing in output**: verify corresponding `blockstates`, `models`, and `textures` exist under `asset_root/<namespace>/...`.
- **Unexpected orientation on some blocks**: check whether that block is currently covered by rotation fix logic.

## Project Scripts

- `bun run build` - production build (minified)
- `bun run build:dev` - development build (inline sourcemap)
