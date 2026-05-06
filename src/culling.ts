import type { ModelElement } from "./model";

type V3 = [number, number, number];
type Rect = [number, number, number, number]; // [u1, v1, u2, v2]

// Blocks that are see-through and should never occlude their neighbours.
// Extend this list as needed.
export const TRANSPARENT_BLOCKS = new Set<string>([
    // Plain glass
    "minecraft:glass",
    "minecraft:glass_pane",
    "minecraft:tinted_glass",
    // Stained glass & panes (all 16 colours)
    "minecraft:white_stained_glass",       "minecraft:white_stained_glass_pane",
    "minecraft:orange_stained_glass",      "minecraft:orange_stained_glass_pane",
    "minecraft:magenta_stained_glass",     "minecraft:magenta_stained_glass_pane",
    "minecraft:light_blue_stained_glass",  "minecraft:light_blue_stained_glass_pane",
    "minecraft:yellow_stained_glass",      "minecraft:yellow_stained_glass_pane",
    "minecraft:lime_stained_glass",        "minecraft:lime_stained_glass_pane",
    "minecraft:pink_stained_glass",        "minecraft:pink_stained_glass_pane",
    "minecraft:gray_stained_glass",        "minecraft:gray_stained_glass_pane",
    "minecraft:light_gray_stained_glass",  "minecraft:light_gray_stained_glass_pane",
    "minecraft:cyan_stained_glass",        "minecraft:cyan_stained_glass_pane",
    "minecraft:purple_stained_glass",      "minecraft:purple_stained_glass_pane",
    "minecraft:blue_stained_glass",        "minecraft:blue_stained_glass_pane",
    "minecraft:brown_stained_glass",       "minecraft:brown_stained_glass_pane",
    "minecraft:green_stained_glass",       "minecraft:green_stained_glass_pane",
    "minecraft:red_stained_glass",         "minecraft:red_stained_glass_pane",
    "minecraft:black_stained_glass",       "minecraft:black_stained_glass_pane",
    // Trapdoors
    "minecraft:oak_trapdoor", "minecraft:jungle_trapdoor",
    "minecraft:acacia_trapdoor", "minecraft:mangrove_trapdoor",
    "minecraft:cherry_trapdoor", "minecraft:bamboo_trapdoor",
    "minecraft:crimson_trapdoor", "minecraft:warped_trapdoor",
    "minecraft:iron_trapdoor", "minecraft:copper_trapdoor",
    "minecraft:exposed_copper_trapdoor", "minecraft:weathered_copper_trapdoor",
    "minecraft:oxidized_copper_trapdoor", "minecraft:waxed_copper_trapdoor",
    "minecraft:waxed_exposed_copper_trapdoor", "minecraft:waxed_weathered_copper_trapdoor",
    "minecraft:waxed_oxidized_copper_trapdoor",
    // Leaves
    "minecraft:oak_leaves", "minecraft:spruce_leaves",
    "minecraft:birch_leaves", "minecraft:jungle_leaves",
    "minecraft:acacia_leaves", "minecraft:dark_oak_leaves",
    "minecraft:mangrove_leaves", "minecraft:mangrove_roots",
    "minecraft:cherry_leaves", "minecraft:pale_oak_leaves",
    "minecraft:azalea_leaves", "minecraft:flowering_azalea_leaves"
]);

interface BlockInfo {
    elements: ModelElement[];
    name: string;
}

const OPPOSITE: Record<CubeFaceDirection, CubeFaceDirection> = {
    north: "south", south: "north",
    east: "west",   west: "east",
    up: "down",     down: "up",
};

const DIR_OFFSET: Record<CubeFaceDirection, V3> = {
    north: [0, 0, -1], south: [0, 0, 1],
    east:  [1, 0,  0], west: [-1, 0, 0],
    up:    [0, 1,  0], down: [0, -1, 0],
};

export function posKey([x, y, z]: V3): string {
    return `${x},${y},${z}`;
}

function facePlanePos(el: ModelElement, dir: CubeFaceDirection): number {
    switch (dir) {
        case "north": return el.from[2];
        case "south": return el.to[2];
        case "west":  return el.from[0];
        case "east":  return el.to[0];
        case "down":  return el.from[1];
        case "up":    return el.to[1];
    }
}

function faceRect(el: ModelElement, dir: CubeFaceDirection): Rect {
    const [x1, y1, z1] = el.from;
    const [x2, y2, z2] = el.to;
    switch (dir) {
        case "north": case "south": return [x1, y1, x2, y2];
        case "west":  case "east":  return [z1, y1, z2, y2];
        case "down":  case "up":    return [x1, z1, x2, z2];
    }
}

function isFullyCovered(target: Rect, covers: Rect[]): boolean {
    const [tu1, tv1, tu2, tv2] = target;
    if (tu1 >= tu2 || tv1 >= tv2) return true;

    // Fast path: one rect contains target
    for (const [cu1, cv1, cu2, cv2] of covers) {
        if (cu1 <= tu1 && cu2 >= tu2 && cv1 <= tv1 && cv2 >= tv2) return true;
    }

    // General path: sweep-line union check
    const clipped: Rect[] = covers
        .map(([cu1, cv1, cu2, cv2]): Rect => [
            Math.max(cu1, tu1), Math.max(cv1, tv1),
            Math.min(cu2, tu2), Math.min(cv2, tv2),
        ])
        .filter(([u1, v1, u2, v2]) => u1 < u2 && v1 < v2);

    if (!clipped.length) return false;

    const vs = new Set<number>([tv1, tv2]);
    for (const [, v1, , v2] of clipped) { vs.add(v1); vs.add(v2); }
    const rows = [...vs].filter(v => v >= tv1 && v < tv2).sort((a, b) => a - b);

    for (const v of rows) {
        const segs = clipped
            .filter(([, v1, , v2]) => v1 <= v && v2 > v)
            .map(([u1, , u2]): [number, number] => [u1, u2]);
        segs.sort(([a], [b]) => a - b);
        let covered = tu1;
        for (const [su, eu] of segs) {
            if (su > covered) return false;
            covered = Math.max(covered, eu);
        }
        if (covered < tu2) return false;
    }
    return true;
}

export function buildPositionMap(
    blocks: Array<{ pos: [number, number, number]; state: number }>,
    paletteElements: ModelElement[][],
    palette: Array<{ name: string }>
): Map<string, BlockInfo> {
    const map = new Map<string, BlockInfo>();
    for (const block of blocks) {
        const els = paletteElements[block.state];
        const name = palette[block.state]?.name ?? "";
        if (els?.length) map.set(posKey(block.pos), { elements: els, name });
    }
    return map;
}

export function cullFaces(
    elements: ModelElement[],
    pos: V3,
    posMap: Map<string, BlockInfo>
): ModelElement[] {
    return elements.map((el): ModelElement => {
        const newFaces = { ...el.faces };

        for (const dir of Object.keys(newFaces) as CubeFaceDirection[]) {
            const plane = facePlanePos(el, dir);
            if (plane !== 0 && plane !== 16) continue;

            const off = DIR_OFFSET[dir];
            const adjKey = posKey([pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]]);
            const adj = posMap.get(adjKey);
            if (!adj) continue;

            // Never cull against see-through blocks
            if (TRANSPARENT_BLOCKS.has(adj.name)) continue;

            const opp = OPPOSITE[dir];
            const adjBoundary = plane === 0 ? 16 : 0;
            const coverRects: Rect[] = adj.elements
                .filter(a => facePlanePos(a, opp) === adjBoundary)
                .map(a => faceRect(a, opp));

            if (isFullyCovered(faceRect(el, dir), coverRects)) {
                delete newFaces[dir];
            }
        }

        return { ...el, faces: newFaces };
    });
}
