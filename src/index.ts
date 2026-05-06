import { read } from "nbtify";

let parseAction: Action;

BBPlugin.register("structure_to_model", {
    title: "Structure to Model",
    author: "Mester",
    description: "Converts Minecraft structures (.nbt) into an item model.",
    icon: "",
    version: "1.0.0",
    variant: "desktop",
    onload,
    onunload,
});

function onload() {
    parseAction = new Action("stm_parse_nbt", {
        name: "STM: Parse NBT to JSON",
        description: "Debug: parse a .nbt structure file and write JSON next to it",
        icon: "file_open",
        click: () => {
            Filesystem.importFile(
                {
                    type: "Minecraft Structure",
                    extensions: ["nbt"],
                    readtype: "buffer",
                },
                async (files) => {
                    if (!files.length) return;
                    const file = files[0]!;
                    try {
                        const nbt = await read(new Uint8Array(file.content as ArrayBuffer));
                        const json = JSON.stringify(nbt, replacer, 2);
                        const outputPath = file.path.replace(/\.nbt$/i, ".json");
                        Filesystem.writeFile(outputPath, { content: json, savetype: "text" });
                        Blockbench.showQuickMessage(`Written: ${outputPath}`);
                    } catch (err) {
                        Blockbench.showMessageBox({
                            title: "NBT Parse Error",
                            message: String(err),
                        });
                    }
                }
            );
        },
    });
    MenuBar.addAction(parseAction, "tools");
}

function onunload() {
    parseAction.delete();
}

function replacer(_key: string, value: unknown): unknown {
    if (value instanceof Int8Array || value instanceof Int32Array) {
        return Array.from(value as Iterable<number>);
    }
    if (value instanceof BigInt64Array) {
        return Array.from(value, (v) => String(v));
    }
    if (typeof value === "bigint") return String(value);
    return value;
}
