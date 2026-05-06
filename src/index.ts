import { StructureImporter } from "./structure";
import { buildStructure } from "./geometry";

const STORAGE_ASSET_ROOT = "stm_asset_root";
const STORAGE_SCALE = "stm_scale";

function getAssetRoot(): string {
    return localStorage.getItem(STORAGE_ASSET_ROOT) ?? "";
}

function getScale(): number {
    return Number(localStorage.getItem(STORAGE_SCALE) ?? "16");
}

let importAction: Action;
let settingsAction: Action;
let settingsDialog: Dialog;

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
    settingsDialog = new Dialog({
        id: "stm_settings",
        title: "Structure to Model Settings",
        form: {
            asset_root: {
                label: "Asset Root",
                description:
                    "Path to the Minecraft assets folder (must contain blockstates/, models/, textures/)",
                type: "folder",
                value: getAssetRoot(),
            },
            scale: {
                label: "Scale",
                description:
                    "Divide world coordinates by this value. Scale 16 = 16 blocks fit in one model unit.",
                type: "number",
                value: getScale(),
                min: 1,
                step: 1,
            },
        },
        onConfirm(result) {
            localStorage.setItem(STORAGE_ASSET_ROOT, result["asset_root"] as string);
            localStorage.setItem(STORAGE_SCALE, String(result["scale"]));
            Blockbench.showQuickMessage("Settings saved.");
        },
    });

    settingsAction = new Action("stm_settings", {
        name: "STM: Settings",
        description: "Configure Structure to Model settings",
        icon: "settings",
        click: () => settingsDialog.show(),
    });

    importAction = new Action("stm_import", {
        name: "STM: Import Structure",
        description: "Import a .nbt structure file and convert it to a model",
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
                        const assetRoot = getAssetRoot();
                        if (!assetRoot) {
                            Blockbench.showMessageBox({
                                title: "Asset Root Not Set",
                                message: "Set the asset root folder in Tools > STM: Settings before importing.",
                            });
                            return;
                        }

                        const scale = getScale();
                        const structureName = file.name.replace(/\.nbt$/i, "");
                        const data = await StructureImporter.fromBuffer(
                            file.content as ArrayBuffer
                        );

                        Blockbench.showQuickMessage(
                            `Building ${data.blocks.length} blocks…`
                        );
                        await buildStructure(structureName, data, assetRoot, scale);
                        Blockbench.showQuickMessage(
                            `Done: ${data.blocks.length} blocks · ${data.size.join("×")}`
                        );
                    } catch (err) {
                        Blockbench.showMessageBox({
                            title: "Structure Import Error",
                            message: String(err),
                        });
                    }
                }
            );
        },
    });

    MenuBar.addAction(importAction, "tools");
    MenuBar.addAction(settingsAction, "tools");
}

function onunload() {
    importAction.delete();
    settingsAction.delete();
}
