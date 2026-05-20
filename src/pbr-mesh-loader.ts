// Helpers to load a GLB asset + a 6-face cubemap into the active PlayCanvas
// app, and to wire the cubemap up as the scene's IBL.

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR,
    PIXELFORMAT_RGBA8,
    Asset,
    AppBase,
    EnvLighting,
    Texture
} from 'playcanvas';

import { PbrMesh } from './pbr-mesh';

// PlayCanvas cube face index order: +X, -X, +Y, -Y, +Z, -Z
const FACE_ORDER = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];

const loadGlb = (app: AppBase, url: string, name?: string): Promise<PbrMesh> => {
    return new Promise((resolve, reject) => {
        const asset = new Asset(name || url, 'container', { url });
        app.assets.add(asset);
        asset.once('load', () => resolve(new PbrMesh(asset)));
        asset.once('error', (err: any) => reject(new Error(String(err))));
        app.assets.load(asset);
    });
};

// Load one face Texture from a URL.
const loadFaceTexture = (app: AppBase, url: string): Promise<Asset> => {
    return new Promise((resolve, reject) => {
        const a = new Asset(url, 'texture', { url });
        a.once('load', () => resolve(a));
        a.once('error', (e: any) => reject(new Error(String(e))));
        app.assets.add(a);
        app.assets.load(a);
    });
};

// Compose a true cubemap Texture directly from 6 face images. Bypasses the
// finicky CubemapHandler / Asset wrapper that v2 dislikes when constructed
// from textures-already-loaded.
const loadCubemap = async (app: AppBase, baseUrl: string, ext = 'jpg'): Promise<Texture> => {
    const faceUrls = FACE_ORDER.map(f => `${baseUrl}/${f}.${ext}`);
    const faceAssets = await Promise.all(faceUrls.map(u => loadFaceTexture(app, u)));
    const sources = faceAssets.map(a => (a.resource as Texture).getSource() as HTMLImageElement);
    const w = sources[0].width;
    const h = sources[0].height;

    const cubeTex = new Texture(app.graphicsDevice, {
        name: 'pbr-skybox',
        width: w,
        height: h,
        format: PIXELFORMAT_RGBA8,
        cubemap: true,
        mipmaps: true,
        magFilter: FILTER_LINEAR,
        minFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    cubeTex.setSource(sources);

    return cubeTex;
};

// Apply a loaded cubemap as both the scene's IBL (via a pre-filtered envAtlas)
// AND the visible skybox. PBR materials need the envAtlas to actually be lit;
// the raw cubemap alone is only a backdrop.
const applyCubemapIbl = (app: AppBase, cubeTex: Texture, showSkybox = true) => {
    // 1. Build the pre-filtered env atlas for IBL on PBR materials.
    const atlas = EnvLighting.generateAtlas(cubeTex, {});
    app.scene.envAtlas = atlas;
    // 2. Show the raw cubemap as the visible backdrop.
    app.scene.skybox = cubeTex;
    app.scene.skyboxIntensity = 1.0;
    app.scene.skyboxMip = showSkybox ? 0 : 4;  // higher mip = blurred backdrop
};

const clearCubemap = (app: AppBase) => {
    app.scene.skybox = null as any;
    app.scene.envAtlas = null;
};

export { loadGlb, loadCubemap, applyCubemapIbl, clearCubemap, FACE_ORDER };
