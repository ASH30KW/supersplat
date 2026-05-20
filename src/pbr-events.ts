// Glue between the PBR panel and the scene/loaders. The panel fires
//   'pbr.selectRoom' { room }   — user picked a different room
//   'pbr.selectGlb'  { glb  }   — user picked a different GLB
//   'pbr.roughness' / 'pbr.metallic' / 'pbr.exposure' / 'pbr.reset'
// The cubemap used for IBL is implicit: '<room>_cubemap'.

import { TranslateGizmo } from 'playcanvas';

import { Scene } from './scene';
import { Events } from './events';
import { PbrMesh } from './pbr-mesh';
import { loadGlb, loadCubemap, applyCubemapIbl, clearCubemap } from './pbr-mesh-loader';

const GLB_URL      = (name: string) => `/glb/${name}.glb`;
const CUBE_URL     = (env: string)  => `/cube/${env}`;
const ROOM_PLY_URL = (name: string) => `/room-ply/${name}.ply`;
const cubemapNameFor = (room: string) => `${room}_cubemap`;

const registerPbrEvents = (scene: Scene, events: Events) => {
    let currentRoom: string | null = null;
    let currentGlb: string | null = null;
    let currentMesh: PbrMesh | null = null;
    let currentCubemap: any = null;        // PlayCanvas Texture
    let cubemapRoomTag: string | null = null;  // which room this cubemap belongs to
    let gizmo: TranslateGizmo | null = null;

    // Auto-attach a translate gizmo to the loaded PBR mesh so it can be moved
    // with the mouse like in the standalone PBR viewer. Detached/destroyed
    // when the GLB is swapped or removed.
    const attachGizmo = (mesh: PbrMesh) => {
        const s: any = scene;
        if (gizmo) {
            try { gizmo.detach(); (gizmo as any).destroy?.(); } catch (e) {}
            gizmo = null;
        }
        const cam = s.camera?.camera;
        const layer = s.gizmoLayer;
        if (!cam || !layer) return;
        const g = new TranslateGizmo(cam, layer);
        const updateSize = () => {
            const canvas = s.canvas;
            if (!canvas) return;
            g.size = 1200 / Math.max(canvas.clientWidth, canvas.clientHeight);
        };
        updateSize();
        events.on('camera.resize', updateSize);
        g.on('render:update', () => { s.forceRender = true; });
        g.attach([mesh.entity]);
        gizmo = g;
    };

    const detachGizmo = () => {
        if (gizmo) {
            try { gizmo.detach(); (gizmo as any).destroy?.(); } catch (e) {}
            gizmo = null;
        }
    };

    // Populate the dropdowns once at startup.
    (async () => {
        try {
            const r = await fetch('/pbr-assets');
            if (r.ok) {
                const opts = await r.json();
                events.fire('pbr.options', opts);
            }
        } catch (e) {
            console.warn('[pbr] /pbr-assets unreachable', e);
        }
    })();

    // Make sure the cubemap matching the current room is loaded and applied.
    // Returns the Texture (or null on failure).
    const ensureCubemapForRoom = async (room: string) => {
        if (cubemapRoomTag === room && currentCubemap) return currentCubemap;
        const app = (scene as any).app;
        try {
            const cube = await loadCubemap(app, CUBE_URL(cubemapNameFor(room)));
            applyCubemapIbl(app, cube, true);
            currentCubemap = cube;
            cubemapRoomTag = room;
            console.log('[pbr] cubemap applied for room', room);
            return cube;
        } catch (err) {
            console.error('[pbr] cubemap load failed for room', room, err);
            return null;
        }
    };

    // ── Room: load PLY + cubemap together ──
    events.on('pbr.selectRoom', async ({ room }: { room: string }) => {
        if (room === currentRoom) return;
        currentRoom = room;
        try {
            // 1. Bring in the cubemap first so any existing GLB is correctly lit
            //    even before the room splats finish streaming.
            await ensureCubemapForRoom(room);
            // 2. Load the room PLY via SuperSplat's own importer.
            console.log('[pbr] loading room', room);
            await events.invoke('import', [{ filename: `${room}.ply`, url: ROOM_PLY_URL(room) }]);
            console.log('[pbr] room loaded');
        } catch (err) {
            console.error('[pbr] room load failed:', err);
        }
    });

    // ── GLB: load and apply the current room's cubemap as IBL ──
    events.on('pbr.selectGlb', async ({ glb }: { glb: string }) => {
        if (glb === currentGlb && currentMesh) return;
        const app = (scene as any).app;
        try {
            // Make sure we have a cubemap before instantiating PBR materials,
            // otherwise they ship without IBL data.
            const room = currentRoom ?? 'Coastal_Loft_Living';
            await ensureCubemapForRoom(room);

            console.log('[pbr] loading GLB', glb);
            const mesh = await loadGlb(app, GLB_URL(glb), glb);
            if (currentMesh) {
                detachGizmo();
                scene.remove(currentMesh);
                currentMesh = null;
            }
            await scene.add(mesh);
            currentMesh = mesh;
            currentGlb = glb;
            attachGizmo(mesh);
            events.fire('pbr.glbDefaults', mesh.getGlbDefaults());
            console.log('[pbr] GLB loaded; defaults', mesh.getGlbDefaults());
        } catch (err) {
            console.error('[pbr] GLB load failed:', err);
        }
    });

    events.on('pbr.roughness', (v: number) => {
        if (currentMesh) currentMesh.setRoughness(v);
    });
    events.on('pbr.metallic', (v: number) => {
        if (currentMesh) currentMesh.setMetallic(v);
    });
    events.on('pbr.exposure', (v: number) => {
        const app = (scene as any).app;
        if (app && app.scene) app.scene.exposure = v;
    });
    events.on('pbr.reset', () => {
        if (currentMesh) {
            currentMesh.resetToGlbDefaults();
            events.fire('pbr.glbDefaults', currentMesh.getGlbDefaults());
        }
    });
};

export { registerPbrEvents };
