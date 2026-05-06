import { read } from "nbtify";
import type { CompoundTag } from "nbtify";

export interface BlockState {
    name: string;
    properties: Record<string, string>;
}

export interface StructureBlock {
    pos: [number, number, number];
    state: number;
}

export interface StructureData {
    size: [number, number, number];
    palette: BlockState[];
    blocks: StructureBlock[];
}

export class StructureImporter {
    static async fromBuffer(content: ArrayBuffer): Promise<StructureData> {
        const nbt = await read(new Uint8Array(content));
        return StructureImporter.parseRoot(nbt.data as CompoundTag);
    }

    private static parseRoot(root: CompoundTag): StructureData {
        const sizeList = root["size"] as unknown[];
        const size: [number, number, number] = [
            Number(sizeList[0]),
            Number(sizeList[1]),
            Number(sizeList[2]),
        ];

        const palette = (root["palette"] as CompoundTag[]).map(
            StructureImporter.parsePaletteEntry
        );

        const blocks = (root["blocks"] as CompoundTag[]).map(
            StructureImporter.parseBlock
        );

        return { size, palette, blocks };
    }

    private static parsePaletteEntry(entry: CompoundTag): BlockState {
        const name = String(entry["Name"]);
        const propsTag = entry["Properties"] as CompoundTag | undefined;
        const properties: Record<string, string> = {};
        if (propsTag) {
            for (const [k, v] of Object.entries(propsTag)) {
                if (v !== undefined) properties[k] = String(v);
            }
        }
        return { name, properties };
    }

    private static parseBlock(block: CompoundTag): StructureBlock {
        const posList = block["pos"] as unknown[];
        const pos: [number, number, number] = [
            Number(posList[0]),
            Number(posList[1]),
            Number(posList[2]),
        ];
        const state = Number(block["state"]);
        return { pos, state };
    }
}
