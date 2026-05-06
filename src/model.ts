import { readJsonFile, modelPath } from "./assets";

export interface FaceData {
    texture: string;
    uv: [number, number, number, number];
    rotation?: number;
}

export interface ElementRotation {
    origin: [number, number, number];
    axis: "x" | "y" | "z";
    angle: number;
}

export interface ModelElement {
    from: [number, number, number];
    to: [number, number, number];
    rotation?: ElementRotation;
    faces: Partial<Record<CubeFaceDirection, FaceData>>;
}

export interface ResolvedModel {
    elements: ModelElement[];
}

interface ModelJsonFace {
    uv?: number[];
    texture?: string;
    rotation?: number;
}

interface ModelJsonElement {
    from: number[];
    to: number[];
    rotation?: { origin: number[]; axis: string; angle: number };
    faces?: Record<string, ModelJsonFace>;
}

interface ModelJson {
    parent?: string;
    elements?: ModelJsonElement[];
    textures?: Record<string, string>;
}

export async function resolveModel(
    assetRoot: string,
    modelId: string,
    cache: Map<string, ResolvedModel>
): Promise<ResolvedModel> {
    if (cache.has(modelId)) return cache.get(modelId)!;

    const chain = await loadModelChain(assetRoot, modelId);

    // Merge textures: root (last in chain) provides defaults, leaf (first) overrides
    const textures: Record<string, string> = {};
    for (let i = chain.length - 1; i >= 0; i--) {
        Object.assign(textures, chain[i]!.textures);
    }

    let elements: ModelElement[] = [];
    for (const model of chain) {
        if (model.elements?.length) {
            elements = model.elements.map((e) => parseElement(e, textures));
            break;
        }
    }

    const resolved: ResolvedModel = { elements };
    cache.set(modelId, resolved);
    return resolved;
}

function resolveTexVar(ref: string, textures: Record<string, string>): string | undefined {
    let current = ref;
    const visited = new Set<string>();
    while (current.startsWith("#")) {
        if (visited.has(current)) return undefined;
        visited.add(current);
        const next = textures[current.slice(1)];
        if (next === undefined) return undefined;
        current = next;
    }
    return current;
}

function autoUV(
    from: number[],
    to: number[],
    face: string
): [number, number, number, number] {
    const [x1, y1, z1] = from as [number, number, number];
    const [x2, y2, z2] = to as [number, number, number];
    switch (face) {
        case "down":  return [x1, z1, x2, z2];
        case "up":    return [x1, z1, x2, z2];
        case "north": return [16 - x2, 16 - y2, 16 - x1, 16 - y1];
        case "south": return [x1, 16 - y2, x2, 16 - y1];
        case "west":  return [z1, 16 - y2, z2, 16 - y1];
        case "east":  return [16 - z2, 16 - y2, 16 - z1, 16 - y1];
        default:      return [0, 0, 16, 16];
    }
}

function parseElement(e: ModelJsonElement, textures: Record<string, string>): ModelElement {
    const faces: Partial<Record<CubeFaceDirection, FaceData>> = {};
    for (const [dir, f] of Object.entries(e.faces ?? {})) {
        if (!f || !f.texture) continue;
        const resolved = resolveTexVar(f.texture, textures);
        if (!resolved) continue;
        const uv: [number, number, number, number] = f.uv
            ? [f.uv[0]!, f.uv[1]!, f.uv[2]!, f.uv[3]!]
            : autoUV(e.from, e.to, dir);
        const faceData: FaceData = { texture: resolved, uv };
        if (f.rotation !== undefined) faceData.rotation = f.rotation;
        faces[dir as CubeFaceDirection] = faceData;
    }

    const el: ModelElement = {
        from: [e.from[0]!, e.from[1]!, e.from[2]!],
        to: [e.to[0]!, e.to[1]!, e.to[2]!],
        faces,
    };
    if (e.rotation) {
        const r = e.rotation;
        const axis = r.axis as "x" | "y" | "z";
        if (axis === "x" || axis === "y" || axis === "z") {
            el.rotation = {
                origin: [r.origin[0]!, r.origin[1]!, r.origin[2]!],
                axis,
                angle: r.angle,
            };
        }
    }
    return el;
}

async function loadModelChain(
    assetRoot: string,
    startId: string
): Promise<ModelJson[]> {
    const chain: ModelJson[] = [];
    let current: string | undefined = startId;
    const visited = new Set<string>();

    while (current) {
        if (visited.has(current)) break;
        visited.add(current);
        try {
            const json: ModelJson = await readJsonFile<ModelJson>(modelPath(assetRoot, current));
            chain.push(json);
            current = json.parent;
        } catch {
            break;
        }
    }

    return chain;
}
