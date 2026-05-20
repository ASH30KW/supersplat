// Wires the PBR panel's events to the loaders/scene. Owns the currently-loaded
// PbrMesh and the current cubemap so subsequent loads can swap them out cleanly.

import { Scene } from './scene';
import { Events } from './events';
import { PbrMesh } from './pbr-mesh';
import { loadGlb, loadCubemap, applyCubemapIbl, clearCubemap } from './pbr-mesh-loader';

// URLs are relative to the same origin that serves SuperSplat (serve_spz.py).
// We rely on extra routes /glb/<name>.glb and /cube/<env>/<face>.jpg, plus
// /pbr-assets returning {glbs:[...], cubemaps:[...]} for the dropdowns.
const GLB_URL  = (name: string) => `/glb/${name}.glb`;
const CUBE_URL = (env: string)  => `/cube/${env}`;

const registerPbrEvents = (scene: Scene, events: Events) => {
    let current: PbrMesh | null = null;
    let currentCubemap: any = null;  // a PlayCanvas Texture

    // Populate the dropdowns once at startup.
    (async () => {
        try {
            const r = await fetch('/pbr-assets');
            if (r.ok) {
                const opts = await r.json();
                events.fire('pbr.options', opts);
            }
        } catch (e) {
            console.warn('[pbr] /pbr-assets endpoint unreachable; using built-in defaults', e);
        }
    })();

    events.on('pbr.load', async ({ glb, cubemap }: { glb: string, cubemap: string }) => {
        const app = (scene as any).app;
        try {
            console.log('[pbr] loading GLB', glb, 'cubemap', cubemap);
            const [mesh, cube] = await Promise.all([
                loadGlb(app, GLB_URL(glb), glb),
                loadCubemap(app, CUBE_URL(cubemap))
            ]);
            // Tear down previous load
            if (current) {
                scene.remove(current);
                current = null;
            }
            if (currentCubemap) {
                clearCubemap(app);
                currentCubemap = null;
            }
            // Add new
            await scene.add(mesh);
            current = mesh;
            applyCubemapIbl(app, cube, true);
            currentCubemap = cube;
            console.log('[pbr] loaded');
        } catch (err) {
            console.error('[pbr] load failed:', err);
        }
    });

    events.on('pbr.roughness', (v: number) => {
        if (current) current.setRoughness(v);
    });
    events.on('pbr.metallic', (v: number) => {
        if (current) current.setMetallic(v);
    });
    events.on('pbr.exposure', (v: number) => {
        const app = (scene as any).app;
        if (app && app.scene) app.scene.exposure = v;
    });
};

export { registerPbrEvents };
