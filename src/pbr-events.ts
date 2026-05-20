// Wires the PBR panel's events to the loaders/scene. Owns the currently-loaded
// PbrMesh and the current cubemap so subsequent loads can swap them out.

import { Scene } from './scene';
import { Events } from './events';
import { PbrMesh } from './pbr-mesh';
import { loadGlb, loadCubemap, applyCubemapIbl, clearCubemap } from './pbr-mesh-loader';

// URLs are relative to the same origin that serves SuperSplat (serve_spz.py).
const GLB_URL      = (name: string) => `/glb/${name}.glb`;
const CUBE_URL     = (env: string)  => `/cube/${env}`;
const ROOM_PLY_URL = (name: string) => `/room-ply/${name}.ply`;

const registerPbrEvents = (scene: Scene, events: Events) => {
    let current: PbrMesh | null = null;
    let currentCubemap: any = null;

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
            // Snap the panel sliders to the GLB's shipped material values.
            events.fire('pbr.glbDefaults', mesh.getGlbDefaults());
            console.log('[pbr] loaded; defaults', mesh.getGlbDefaults());
        } catch (err) {
            console.error('[pbr] load failed:', err);
        }
    });

    // Hand a room PLY URL to SuperSplat's own importer — it handles 3DGS PLYs
    // natively, including the camera-fit and the splat layer setup.
    events.on('pbr.loadRoom', async ({ room }: { room: string }) => {
        const url = ROOM_PLY_URL(room);
        try {
            console.log('[pbr] loading room', room, url);
            await events.invoke('import', [{ filename: `${room}.ply`, url }]);
            console.log('[pbr] room loaded');
        } catch (err) {
            console.error('[pbr] room load failed:', err);
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
    events.on('pbr.reset', () => {
        if (current) {
            current.resetToGlbDefaults();
            events.fire('pbr.glbDefaults', current.getGlbDefaults());
        }
    });
};

export { registerPbrEvents };
