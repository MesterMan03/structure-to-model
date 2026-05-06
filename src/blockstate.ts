export interface ModelRef {
    model: string;
    x?: number;
    y?: number;
    uvlock?: boolean;
}

interface VariantEntry {
    model: string;
    x?: number;
    y?: number;
    uvlock?: boolean;
    weight?: number;
}

type SimpleWhenCondition = Record<string, string>;
type WhenCondition = SimpleWhenCondition | { OR: SimpleWhenCondition[] };

interface VariantsBlockstate {
    variants: Record<string, VariantEntry | VariantEntry[]>;
}

interface MultipartBlockstate {
    multipart: Array<{
        apply: VariantEntry | VariantEntry[];
        when?: WhenCondition;
    }>;
}

type BlockstateJson = VariantsBlockstate | MultipartBlockstate;

export function resolveBlockstate(
    json: BlockstateJson,
    properties: Record<string, string>
): ModelRef[] {
    if ("variants" in json) return resolveVariants(json.variants, properties);
    if ("multipart" in json) return resolveMultipart(json.multipart, properties);
    return [];
}

function resolveVariants(
    variants: Record<string, VariantEntry | VariantEntry[]>,
    properties: Record<string, string>
): ModelRef[] {
    let bestKey = "";
    let bestScore = -1;

    for (const key of Object.keys(variants)) {
        if (key === "") {
            if (bestScore < 0) { bestKey = key; bestScore = 0; }
            continue;
        }
        const pairs = key.split(",");
        if (pairs.length <= bestScore) continue;
        const matches = pairs.every((pair) => {
            const eq = pair.indexOf("=");
            const val = properties[pair.slice(0, eq)];
            return val === undefined || val === pair.slice(eq + 1);
        });
        if (matches) { bestKey = key; bestScore = pairs.length; }
    }

    const entry = variants[bestKey];
    if (!entry) return [];
    const v = Array.isArray(entry) ? entry[0]! : entry;
    return [{ model: v.model, x: v.x, y: v.y, uvlock: v.uvlock }];
}

function resolveMultipart(
    parts: MultipartBlockstate["multipart"],
    properties: Record<string, string>
): ModelRef[] {
    const refs: ModelRef[] = [];
    for (const part of parts) {
        if (part.when && !matchesWhen(part.when, properties)) continue;
        const v = Array.isArray(part.apply) ? part.apply[0]! : part.apply;
        refs.push({ model: v.model, x: v.x, y: v.y, uvlock: v.uvlock });
    }
    return refs;
}

function matchesWhen(
    when: WhenCondition,
    properties: Record<string, string>
): boolean {
    const orConditions = (when as { OR?: SimpleWhenCondition[] }).OR;
    if (Array.isArray(orConditions)) {
        return orConditions.some((cond) => matchesCondition(cond, properties));
    }
    return matchesCondition(when as SimpleWhenCondition, properties);
}

function matchesCondition(
    cond: SimpleWhenCondition,
    properties: Record<string, string>
): boolean {
    return Object.entries(cond).every(([k, v]) =>
        v.split("|").includes(properties[k] ?? "")
    );
}
