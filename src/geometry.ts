import { readJsonFile, blockstatePath } from "./assets";
import { resolveBlockstate, type ModelRef } from "./blockstate";
import { resolveModel, type ModelElement, type ResolvedModel } from "./model";
import { applyBlockstateRotation } from "./rotation";
import { getOrCreateTexture, getOrCreateTintedTexture, clearTintedTextures } from "./textures";
import { buildPositionMap, cullFaces } from "./culling";
import type { StructureData } from "./structure";


export async function buildStructure(
    structureName: string,
    data: StructureData,
    assetRoot: string,
    scale: number,
    tintColor?: string
): Promise<void> {
    const modelCache = new Map<string, ResolvedModel>();
    clearTintedTextures();

    Blockbench.setProgress(0);
    const paletteElements = await resolvePalette(data.palette, assetRoot, modelCache);
    const posMap = buildPositionMap(data.blocks, paletteElements, data.palette);

    const total = data.blocks.length;
    let facesCulled = 0;

    Undo.initEdit({ outliner: true, elements: [], textures: [] });

    const rootGroup = new Group({ name: structureName, origin: [0, 0, 0] });
    rootGroup.addTo().init();

    for (let bi = 0; bi < total; bi++) {
        const block = data.blocks[bi]!;
        const entry = data.palette[block.state];
        if (!entry) continue;

        const rawElements = paletteElements[block.state] ?? [];
        if (!rawElements.length) continue;

        const elements = cullFaces(rawElements, block.pos, posMap);
        facesCulled += countFaces(rawElements) - countFaces(elements);

        const visibleEls = elements.filter(e => Object.keys(e.faces).length > 0);
        if (!visibleEls.length) continue;

        const blockName = entry.name.includes(":")
            ? entry.name.split(":")[1]!
            : entry.name;

        if (visibleEls.length === 1) {
            (await makeCube(blockName, block.pos, visibleEls[0]!, scale, assetRoot, tintColor))
                .addTo(rootGroup).init();
        } else {
            const blockGroup = new Group({ name: blockName, origin: [0, 0, 0] });
            blockGroup.addTo(rootGroup).init();
            for (const el of visibleEls) {
                (await makeCube(undefined, block.pos, el, scale, assetRoot, tintColor))
                    .addTo(blockGroup).init();
            }
        }

        if (bi % 100 === 0) {
            Blockbench.setProgress(0.3 + (bi / total) * 0.7);
            Blockbench.showQuickMessage(`Importing… ${bi}/${total} blocks`, 500);
            await new Promise<void>(r => setTimeout(r, 0));
        }
    }

    Undo.finishEdit(`Import structure: ${structureName}`);

    Canvas.updateAll();
    updateInterface();

    Blockbench.setProgress(1);
    Blockbench.showQuickMessage(
        `Done: ${total} blocks · ${data.size.join("×")} · ${facesCulled} faces culled`,
        5000
    );
    setTimeout(() => Blockbench.setProgress(0), 1500);
}

function countFaces(elements: ModelElement[]): number {
    return elements.reduce((n, e) => n + Object.keys(e.faces).length, 0);
}

async function makeCube(
    name: string | undefined,
    blockPos: [number, number, number],
    el: ModelElement,
    scale: number,
    assetRoot: string,
    tintColor?: string
): Promise<Cube> {
    const faceOptions: Partial<Record<CubeFaceDirection, CubeFaceOptions>> = {};

    for (const dir of Object.keys(el.faces) as CubeFaceDirection[]) {
        const face = el.faces[dir]!;
        try {
            const useTint = face.tintindex !== undefined && tintColor !== undefined;
            const tex = useTint
                ? await getOrCreateTintedTexture(assetRoot, face.texture, tintColor!)
                : getOrCreateTexture(assetRoot, face.texture);
            const opts: CubeFaceOptions = { texture: tex, uv: face.uv, enabled: true };
            if (face.rotation !== undefined) opts.rotation = face.rotation;
            faceOptions[dir] = opts;
        } catch {
            // omit face entirely if texture unavailable
        }
    }

    const options: ICubeOptions = {
        name,
        from: toModel(blockPos, el.from, scale),
        to: toModel(blockPos, el.to, scale),
        autouv: 0,
        faces: faceOptions,
    };
    if (el.rotation) {
        const r = el.rotation;
        options.origin = toModel(blockPos, r.origin, scale);
        options.rotation = [
            r.axis === "x" ? r.angle : 0,
            r.axis === "y" ? r.angle : 0,
            r.axis === "z" ? r.angle : 0,
        ];
    }
    const cube = new Cube(options);
    for (const dir of Object.keys(cube.faces) as CubeFaceDirection[]) {
        if (!faceOptions[dir]) (cube.faces[dir] as any).texture = null;
    }
    return cube;
}

async function resolvePalette(
    palette: StructureData["palette"],
    assetRoot: string,
    modelCache: Map<string, ResolvedModel>
): Promise<ModelElement[][]> {
    const result: ModelElement[][] = [];
    for (let i = 0; i < palette.length; i++) {
        result.push(await resolveEntryElements(palette[i]!, assetRoot, modelCache));
        Blockbench.setProgress((i / palette.length) * 0.3);
        await new Promise<void>(r => setTimeout(r, 0));
    }
    return result;
}

async function resolveEntryElements(
    entry: StructureData["palette"][number],
    assetRoot: string,
    modelCache: Map<string, ResolvedModel>
): Promise<ModelElement[]> {
    let blockstateJson: unknown;
    try {
        blockstateJson = await readJsonFile(blockstatePath(assetRoot, entry.name));
    } catch {
        return [];
    }

    let refs: ModelRef[];
    try {
        refs = resolveBlockstate(
            blockstateJson as Parameters<typeof resolveBlockstate>[0],
            entry.properties
        );
    } catch {
        return [];
    }

    const elements: ModelElement[] = [];
    for (const ref of refs) {
        try {
            const resolved = await resolveModel(assetRoot, ref.model, modelCache);
            // Pass entry.name so rotation.ts can apply the whitelist-gated y-flip fix
            const rotated = applyBlockstateRotation(resolved.elements, ref, entry.name);
            elements.push(...rotated);
        } catch {
            // skip missing model
        }
    }

    return elements;
}

// Combine integer block position (block units) with local voxel coords (0-16)
// into Blockbench model space so blocks stay gapless at any scale value.
function toModel(
    blockPos: [number, number, number],
    local: [number, number, number],
    scale: number
): [number, number, number] {
    return [
        (blockPos[0] * 16 + local[0]) / scale,
        (blockPos[1] * 16 + local[1]) / scale,
        (blockPos[2] * 16 + local[2]) / scale,
    ];
}
