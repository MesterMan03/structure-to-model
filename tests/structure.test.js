import { expect, test } from "bun:test";
import { Int32, write } from "nbtify";
import { blockstatePath } from "../src/assets";
import { StructureImporter } from "../src/structure";

async function importPalette(palette) {
    const ints = values => values.map(value => new Int32(value));
    const bytes = await write({
        size: ints([1, 1, 1]),
        palette,
        blocks: [{ pos: ints([0, 0, 0]), state: new Int32(0) }],
    }, { compression: "gzip" });
    return StructureImporter.fromBuffer(bytes.slice().buffer);
}

for (const [format, entry] of [
    ["legacy", { Name: "minecraft:oak_log", Properties: { axis: "x" } }],
    ["modern", { id: "minecraft:oak_log", properties: { axis: "x" } }],
]) {
    test(`${format} palette resolves the log and preserves its axis`, async () => {
        const { palette, blocks } = await importPalette([entry]);
        const state = palette[blocks[0].state];
        expect(blockstatePath("assets", state.name)).toBe("assets/minecraft/blockstates/oak_log.json");
        expect(state.properties).toEqual({ axis: "x" });
    });
}

test("legacy fields take precedence when both spellings exist", async () => {
    const { palette } = await importPalette([{
        Name: "example:log", id: "example:other",
        Properties: { axis: "x" }, properties: { axis: "y" },
    }, { id: "stone" }]);
    expect(palette).toEqual([
        { name: "example:log", properties: { axis: "x" } },
        { name: "stone", properties: {} },
    ]);
});

for (const entry of [{}, { Name: "" }, { id: "  " }, { id: new Int32(1) }]) {
    test(`rejects invalid identifier in ${JSON.stringify(entry)}`, async () => {
        await expect(importPalette([{ Name: "stone" }, entry]))
            .rejects.toThrow(/palette\[1\].*Name.*id/);
    });
}

test("rejects a properties tag with the wrong type", async () => {
    await expect(importPalette([{ id: "stone", properties: "axis=x" }]))
        .rejects.toThrow(/palette\[0\].*properties.*compound/i);
});
