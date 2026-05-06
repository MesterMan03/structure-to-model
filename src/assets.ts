function readTextFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        Filesystem.readFile([path], { readtype: "text" }, (files) => {
            const file = files[0];
            if (!file?.content) {
                reject(new Error(`Cannot read: ${path}`));
                return;
            }
            resolve(file.content as string);
        });
    });
}

export async function readJsonFile<T = unknown>(path: string): Promise<T> {
    const text = await readTextFile(path);
    return JSON.parse(text) as T;
}

export function parseNamespace(id: string): [string, string] {
    const colon = id.indexOf(":");
    if (colon === -1) return ["minecraft", id];
    return [id.slice(0, colon), id.slice(colon + 1)];
}

export function blockstatePath(assetRoot: string, blockId: string): string {
    const [ns, name] = parseNamespace(blockId);
    return `${assetRoot}/${ns}/blockstates/${name}.json`;
}

export function modelPath(assetRoot: string, modelId: string): string {
    const [ns, path] = parseNamespace(modelId);
    return `${assetRoot}/${ns}/models/${path}.json`;
}
