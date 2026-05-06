import { parseNamespace } from "./assets";

const textureCache = new Map<string, Texture>();
const tintedTextureSet = new Set<Texture>();

export function clearTintedTextures(): void {
    tintedTextureSet.clear();
}

export function getUsedTintedTextures(): ReadonlySet<Texture> {
    return tintedTextureSet;
}

export function texturePath(assetRoot: string, textureId: string): string {
    const [ns, path] = parseNamespace(textureId);
    return `${assetRoot}/${ns}/textures/${path}.png`;
}

export function getOrCreateTexture(assetRoot: string, textureId: string): Texture {
    const absPath = texturePath(assetRoot, textureId);
    if (textureCache.has(absPath)) return textureCache.get(absPath)!;
    const segments = textureId.split("/");
    const name = segments[segments.length - 1]!;
    const tex = new Texture({ name, path: absPath }).fromPath(absPath).add(false);
    textureCache.set(absPath, tex);
    return tex;
}

export async function getOrCreateTintedTexture(
    assetRoot: string,
    textureId: string,
    hexColor: string
): Promise<Texture> {
    const absPath = texturePath(assetRoot, textureId);
    const cacheKey = `${absPath}|${hexColor}`;
    if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

    const original = getOrCreateTexture(assetRoot, textureId);
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    const segments = textureId.split("/");
    const name = segments[segments.length - 1]!;

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                d[i] = (d[i] ?? 0) * r;
                d[i + 1] = (d[i + 1] ?? 0) * g;
                d[i + 2] = (d[i + 2] ?? 0) * b;
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error(`Failed to tint: ${textureId}`));
        img.src = original.source;
    });

    const tex = new Texture({ name }).fromDataURL(dataUrl).add(false);
    tintedTextureSet.add(tex);
    textureCache.set(cacheKey, tex);
    return tex;
}
