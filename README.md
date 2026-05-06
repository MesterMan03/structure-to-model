# Structure to Model (Blockbench Plugin)

Import a Minecraft structure file (`.nbt`) into Blockbench and convert it into an editable model.

## Features

- Imports Minecraft structure NBT files (`Tools > STM: Import Structure`)
- Resolves blockstates (`variants` and `multipart`) using block properties from the structure palette
- Resolves model parent chains and texture variable references (`#texture_var`)
- Neighbor-aware face culling using a sweep-line rectangle coverage algorithm to eliminate hidden geometry
- Transparent block culling exceptions (glass, panes, stained glass, trapdoors, leaves)
- Tinted texture support with biome presets (Plains, Jungle, Swamp, Desert, Snowy) and custom hex color
- Texture, model, and tinted-texture caching for faster imports
- Configurable world-to-model scale (default `16`)
- Progress bar and block count summary during import

## Requirements

- Blockbench Desktop (the plugin requires direct access to the filesystem to read assets and save tinted textures)
- Minecraft assets folder arranged by namespace:
  - `<asset_root>/minecraft/blockstates/...`
  - `<asset_root>/minecraft/models/...`
  - `<asset_root>/minecraft/textures/...`

`asset_root` is the folder that contains namespace folders (`minecraft`, mod namespaces, etc.), not the `textures` folder itself.

## Install / Build (Development)

Install dependencies:

```bash
bun install
```

Production build:

```bash
bun run build
```

Development build with inline sourcemap:

```bash
bun run build:dev
```

Output: `dist/structure_to_model.js`

## Using the Plugin in Blockbench

1. Load/install the built plugin file (`dist/structure_to_model.js`) in Blockbench.
2. Open `Tools > STM: Settings` and configure:
   - **Asset Root** — your Minecraft assets root folder
   - **Scale** — coordinate divisor (default `16`)
   - **Tint Preset** — biome tint applied to grass/leaf textures: None, Plains, Jungle, Swamp, Desert, Snowy, or Custom
   - **Custom Tint Color** — hex color used when Tint Preset is set to Custom
3. Open `Tools > STM: Import Structure` and select a `.nbt` structure file.
4. Wait for import to complete. The plugin creates a root group named after the structure file.
5. If tinted textures were generated, you will be prompted to save them to a resource pack (provide a namespace and path).

## Scale Behavior

Block coordinates and voxel-local coordinates are combined as:

`(block_pos * 16 + local_voxel_pos) / scale`

Common values:

- `16` — 1 block = 1 model unit
- `1` — 1 Minecraft voxel = 1 model unit

## Limitations

- Missing blockstate, model, or texture files are silently skipped for that block
- For weighted blockstate variant entries, only the first candidate is used (weights are ignored)
- Transparent block culling exceptions are hardcoded; custom modded blocks are not automatically recognized
- Elements with X or Z axis rotation bypass face culling to avoid incorrect occlusion
- A rotation correction whitelist is applied to buttons and levers to fix specific x-rotation cases; custom blocks in similar configurations may not be covered
- No entity, tile-entity, or biome data is imported — geometry only

## Troubleshooting

- **"Asset Root Not Set"** — configure `Tools > STM: Settings` first.
- **Blocks missing in output** — verify corresponding `blockstates`, `models`, and `textures` exist under `asset_root/<namespace>/...`.
- **Unexpected orientation on some blocks** — check whether that block is covered by the rotation fix whitelist (buttons, levers).
- **Tinted textures not appearing** — ensure Tint Preset is set and save the generated textures to your resource pack when prompted.
