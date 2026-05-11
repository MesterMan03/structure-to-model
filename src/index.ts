import { StructureImporter } from "./structure";
import { buildStructure } from "./geometry";
import { getUsedTintedTextures } from "./textures";

const STORAGE_ASSET_ROOT = "stm_asset_root";
const STORAGE_SCALE = "stm_scale";
const STORAGE_TINT_PRESET = "stm_tint_preset";
const STORAGE_TINT_COLOR = "stm_tint_color";
const STORAGE_PACK_ROOT = "stm_pack_root";
const STORAGE_TINT_PATH = "stm_tint_path";

const TINT_PRESETS: Record<string, string> = {
    plains: "#79C05A",
    jungle: "#59C93C",
    swamp: "#6A7039",
    desert: "#BFB755",
    snowy: "#80B497",
};

function getAssetRoot(): string {
    return localStorage.getItem(STORAGE_ASSET_ROOT) ?? "";
}

function getScale(): number {
    return Number(localStorage.getItem(STORAGE_SCALE) ?? "16");
}

function getTintPreset(): string {
    return localStorage.getItem(STORAGE_TINT_PRESET) ?? "none";
}

function getTintCustomColor(): string {
    return localStorage.getItem(STORAGE_TINT_COLOR) ?? "#79C05A";
}

function getPackRoot(): string {
    return localStorage.getItem(STORAGE_PACK_ROOT) ?? "";
}

function getTintPath(): string {
    return localStorage.getItem(STORAGE_TINT_PATH) ?? "";
}

function getTintColor(): string | undefined {
    const preset = getTintPreset();
    if (preset === "none") return undefined;
    if (preset === "custom") return getTintCustomColor();
    return TINT_PRESETS[preset];
}

function saveTintedTexturesToDisk(
    textures: ReadonlySet<Texture>,
    packRoot: string,
    textureId: string
): void {
    const fs = requireNativeModule("fs");
    if (!fs) {
        Blockbench.showMessageBox({
            title: "File System Access Required",
            message: "Could not access the file system to save tinted textures.",
        });
        return;
    }
    const path = requireNativeModule("path");

    const colon = textureId.indexOf(":");
    const namespace = colon >= 0 ? textureId.slice(0, colon) : "minecraft";
    const pathPrefix = colon >= 0 ? textureId.slice(colon + 1) : textureId;

    const targetDir = path.join(packRoot, "assets", namespace, "textures", "block", pathPrefix);
    fs.mkdirSync(targetDir, { recursive: true });

    for (const tex of textures) {
        const filePath = path.join(targetDir, `${tex.name}.png`);

        const src = tex.source;
        const base64 = src.slice(src.indexOf(",") + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        fs.writeFileSync(filePath, bytes);

        tex.fromPath(filePath);
    }

    Blockbench.showQuickMessage(
        `Saved ${textures.size} tinted texture${textures.size === 1 ? "" : "s"} to resource pack.`,
        4000
    );
}

function showSaveTintedDialog(textures: ReadonlySet<Texture>): void {
    new Dialog({
        id: "stm_save_tinted",
        title: "Save Tinted Textures",
        lines: [
            `<p style="margin:0 0 4px">${textures.size} tinted texture${textures.size === 1 ? " was" : "s were"} generated. Provide a location in your resource pack to save them.</p>`,
        ],
        form: {
            pack_root: {
                label: "Resource Pack Root",
                description: "Folder containing pack.mcmeta",
                type: "folder",
                value: getPackRoot(),
            },
            texture_id: {
                label: "Target Texture Path",
                description: "Namespace and path prefix, e.g. example:ship/test",
                type: "text",
                value: getTintPath(),
            },
        },
        onConfirm(result) {
            const packRoot = result["pack_root"] as string;
            const textureId = result["texture_id"] as string;
            if (!packRoot || !textureId) {
                Blockbench.showMessageBox({
                    title: "Missing Input",
                    message: "Both the resource pack root and texture path are required.",
                });
                return;
            }
            localStorage.setItem(STORAGE_PACK_ROOT, packRoot);
            localStorage.setItem(STORAGE_TINT_PATH, textureId);
            try {
                saveTintedTexturesToDisk(textures, packRoot, textureId);
            } catch (err) {
                Blockbench.showMessageBox({
                    title: "Save Error",
                    message: String(err),
                });
            }
        },
    }).show();
}

let importAction: Action;
let settingsAction: Action;
let settingsDialog: Dialog;

BBPlugin.register("structure_to_model", {
    title: "Structure to Model",
    author: "Mester",
    icon: "account_balance",
    description: "Converts Minecraft Java structures (.nbt) into a model.",
    version: "1.0.0",
    variant: "desktop",
    repository: "https://github.com/MesterMan03/structure-to-model",
    bug_tracker: "https://github.com/MesterMan03/structure-to-model/issues",
    creation_date: "2026/05/06",
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
            tint_preset: {
                label: "Tint Preset",
                description: "Biome tint color applied to leaves, grass, and other tinted block faces.",
                type: "select",
                value: getTintPreset(),
                options: {
                    none: "None",
                    plains: "Plains (#79C05A)",
                    jungle: "Jungle (#59C93C)",
                    swamp: "Swamp (#6A7039)",
                    desert: "Desert / Savanna (#BFB755)",
                    snowy: "Snowy Tundra (#80B497)",
                    custom: "Custom…",
                },
            },
            tint_color: {
                label: "Custom Tint Color",
                description: "Used only when 'Custom…' is selected above.",
                type: "color",
                value: getTintCustomColor(),
            },
        },
        onConfirm(result) {
            localStorage.setItem(STORAGE_ASSET_ROOT, result["asset_root"] as string);
            localStorage.setItem(STORAGE_SCALE, String(result["scale"]));
            localStorage.setItem(STORAGE_TINT_PRESET, result["tint_preset"] as string);
            localStorage.setItem(STORAGE_TINT_COLOR, result["tint_color"] as string);
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
                        const tintColor = getTintColor();
                        const structureName = file.name.replace(/\.nbt$/i, "");
                        const data = await StructureImporter.fromBuffer(
                            file.content as ArrayBuffer
                        );

                        Blockbench.showQuickMessage(
                            `Building ${data.blocks.length} blocks…`
                        );
                        await buildStructure(structureName, data, assetRoot, scale, tintColor);

                        const tintedTextures = getUsedTintedTextures();
                        if (tintedTextures.size > 0) {
                            showSaveTintedDialog(tintedTextures);
                        }
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
