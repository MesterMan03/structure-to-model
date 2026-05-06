import { parseNamespace } from "./assets";

const textureCache = new Map<string, Texture>();

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
