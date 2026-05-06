import type { ModelElement, FaceData } from "./model";
import type { ModelRef } from "./blockstate";

type V3 = [number, number, number];
type Axis = "x" | "y" | "z";

// Blocks where the x-rotation 180° y-flip correction is applied.
// "facing" on these blocks means the outward direction of the face, so after rotX90
// the geometry ends up 180° backwards and needs a compensating y-flip.
// Add more block IDs here as confirmed through testing.
export const X_ROT_FIX_BLOCKS = new Set<string>([
    // Buttons
    "minecraft:oak_button", "minecraft:spruce_button", "minecraft:birch_button",
    "minecraft:jungle_button", "minecraft:acacia_button", "minecraft:dark_oak_button",
    "minecraft:mangrove_button", "minecraft:cherry_button", "minecraft:bamboo_button",
    "minecraft:crimson_button", "minecraft:warped_button",
    "minecraft:stone_button", "minecraft:polished_blackstone_button",
    // Levers
    "minecraft:lever",
]);

// Y 90° CW (from above): N→E→S→W cycle — furnace y=90→east, stairs y=90→south, fence y=90→east ✓
function rotY90([x, y, z]: V3): V3 { return [16 - z, y, x]; }

// X 90°: UP→SOUTH (top tilts toward south)
function rotX90([x, y, z]: V3): V3 { return [x, 16 - z, y]; }

function minmax(a: V3, b: V3): [V3, V3] {
    return [
        [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
        [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    ];
}

function axisUnderY90(axis: Axis, angle: number): { axis: Axis; angle: number } {
    if (axis === "x") return { axis: "z", angle };
    if (axis === "z") return { axis: "x", angle: -angle };
    return { axis, angle };
}

function axisUnderX90(axis: Axis, angle: number): { axis: Axis; angle: number } {
    if (axis === "y") return { axis: "z", angle };
    if (axis === "z") return { axis: "y", angle: -angle };
    return { axis, angle };
}

function rotateFacesX90(faces: Partial<Record<CubeFaceDirection, FaceData>>): Partial<Record<CubeFaceDirection, FaceData>> {
    const r: Partial<Record<CubeFaceDirection, FaceData>> = {};
    if (faces.north !== undefined) r.up = faces.north;
    if (faces.up !== undefined) r.south = faces.up;
    if (faces.south !== undefined) r.down = faces.south;
    if (faces.down !== undefined) r.north = faces.down;
    if (faces.east !== undefined) r.east = faces.east;
    if (faces.west !== undefined) r.west = faces.west;
    return r;
}

function rotateFacesY90(faces: Partial<Record<CubeFaceDirection, FaceData>>): Partial<Record<CubeFaceDirection, FaceData>> {
    const r: Partial<Record<CubeFaceDirection, FaceData>> = {};
    if (faces.north !== undefined) r.east = faces.north;
    if (faces.east !== undefined) r.south = faces.east;
    if (faces.south !== undefined) r.west = faces.south;
    if (faces.west !== undefined) r.north = faces.west;
    if (faces.up !== undefined) r.up = faces.up;
    if (faces.down !== undefined) r.down = faces.down;
    return r;
}

export function applyBlockstateRotation(
    elements: ModelElement[],
    ref: ModelRef,
    blockName?: string
): ModelElement[] {
    const xSteps = (Math.round((ref.x ?? 0) / 90) & 3);
    const ySteps = (Math.round((ref.y ?? 0) / 90) & 3);
    if (!xSteps && !ySteps) return elements;

    return elements.map((el) => {
        let from: V3 = [...el.from];
        let to: V3 = [...el.to];
        let rotOrigin: V3 | undefined = el.rotation ? [...el.rotation.origin] : undefined;
        let rotAxis = el.rotation?.axis;
        let rotAngle = el.rotation?.angle;
        let faces = el.faces;

        for (let i = 0; i < xSteps; i++) {
            from = rotX90(from); to = rotX90(to);
            if (rotOrigin) rotOrigin = rotX90(rotOrigin);
            if (rotAxis !== undefined && rotAngle !== undefined)
                ({ axis: rotAxis, angle: rotAngle } = axisUnderX90(rotAxis, rotAngle));
            faces = rotateFacesX90(faces);
        }

        for (let i = 0; i < ySteps; i++) {
            from = rotY90(from); to = rotY90(to);
            if (rotOrigin) rotOrigin = rotY90(rotOrigin);
            if (rotAxis !== undefined && rotAngle !== undefined)
                ({ axis: rotAxis, angle: rotAngle } = axisUnderY90(rotAxis, rotAngle));
            faces = rotateFacesY90(faces);
        }

        // Apply 180° y-flip correction for whitelisted blocks only.
        // These blocks use "facing" to mean the outward face direction, which ends up
        // inverted after rotX90. Only applied when the block is in X_ROT_FIX_BLOCKS.
        if (xSteps > 0 && blockName && X_ROT_FIX_BLOCKS.has(blockName)) {
            for (let i = 0; i < 2; i++) {
                from = rotY90(from); to = rotY90(to);
                if (rotOrigin) rotOrigin = rotY90(rotOrigin);
                if (rotAxis !== undefined && rotAngle !== undefined)
                    ({ axis: rotAxis, angle: rotAngle } = axisUnderY90(rotAxis, rotAngle));
                faces = rotateFacesY90(faces);
            }
        }

        const [nFrom, nTo] = minmax(from, to);
        return {
            from: nFrom,
            to: nTo,
            rotation:
                el.rotation && rotOrigin && rotAxis !== undefined && rotAngle !== undefined
                    ? { origin: rotOrigin, axis: rotAxis, angle: rotAngle }
                    : undefined,
            faces,
        };
    });
}
