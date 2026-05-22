// Glue between the PBR panel and the scene/loaders. The panel fires
//   'pbr.selectRoom' { room }   — user picked a different room
//   'pbr.selectGlb'  { glb  }   — user picked a different GLB
//   'pbr.roughness' / 'pbr.metallic' / 'pbr.exposure' / 'pbr.reset'
// The cubemap used for IBL is implicit: '<room>_cubemap'.

import { RotateGizmo, ScaleGizmo, TranslateGizmo } from 'playcanvas';

type GizmoMode = 'translate' | 'rotate' | 'scale';
type AnyGizmo = TranslateGizmo | RotateGizmo | ScaleGizmo;

import { Scene } from './scene';
import { Events } from './events';
import { PbrMesh } from './pbr-mesh';
import { ElementType } from './element';
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
    let gizmo: AnyGizmo | null = null;
    let gizmoMode: GizmoMode = 'translate';

    // Attach a gizmo of the given mode to the PbrMesh's entity. Recreates the
    // gizmo from scratch when switching mode — Translate/Rotate/Scale are
    // distinct PlayCanvas classes, can't reuse one instance.
    const attachGizmo = (mesh: PbrMesh, mode: GizmoMode = gizmoMode) => {
        const s: any = scene;
        if (gizmo) {
            try { gizmo.detach(); (gizmo as any).destroy?.(); } catch (e) {}
            gizmo = null;
        }
        const cam = s.camera?.camera;
        const layer = s.gizmoLayer;
        if (!cam || !layer) return;
        const Ctor = mode === 'rotate' ? RotateGizmo
                  : mode === 'scale'  ? ScaleGizmo
                                      : TranslateGizmo;
        const g = new Ctor(cam, layer);
        // Scale: hide per-axis/plane handles and keep only the central xyz box
        // so dragging always scales uniformly (matches SuperSplat's own tool).
        if (mode === 'scale') {
            const sg = g as ScaleGizmo;
            (['x', 'y', 'z', 'yz', 'xz', 'xy'] as const).forEach(a => sg.enableShape(a, false));
            sg.lowerBoundScale.set(1e-6, 1e-6, 1e-6);
        }
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
        gizmoMode = mode;
    };

    const detachGizmo = () => {
        if (gizmo) {
            try { gizmo.detach(); (gizmo as any).destroy?.(); } catch (e) {}
            gizmo = null;
        }
    };

    events.on('pbr.gizmoMode', (mode: GizmoMode) => {
        if (currentMesh) attachGizmo(currentMesh, mode);
        else gizmoMode = mode;
    });

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
            // 2. Drop any previously-loaded room splats so only the current
            //    selection is visible.
            const existing = scene.getElementsByType(ElementType.splat);
            for (const el of existing) scene.remove(el);
            // 3. Load the room PLY via SuperSplat's own importer.
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
            events.fire('pbr.meshChanged', mesh);
            events.fire('pbr.glbDefaults', mesh.getGlbDefaults());
            events.fire('pbr.glbLoaded');
            console.log('[pbr] GLB loaded; defaults', mesh.getGlbDefaults());
        } catch (err) {
            console.error('[pbr] GLB load failed:', err);
        }
    });

    // Sliders only mutate material parameters; the renderer is otherwise idle
    // when the camera isn't moving, so we have to nudge it to redraw.
    const forceRender = () => { (scene as any).forceRender = true; };

    events.on('pbr.roughness', (v: number) => {
        if (currentMesh) currentMesh.setRoughness(v);
        forceRender();
    });
    events.on('pbr.metallic', (v: number) => {
        if (currentMesh) currentMesh.setMetallic(v);
        forceRender();
    });
    events.on('pbr.exposure', (v: number) => {
        const app = (scene as any).app;
        if (app && app.scene) app.scene.exposure = v;
        forceRender();
    });
    events.on('pbr.reset', () => {
        if (currentMesh) {
            currentMesh.resetToGlbDefaults();
            events.fire('pbr.glbDefaults', currentMesh.getGlbDefaults());
            forceRender();
        }
    });

    // Uniform scale via manual input. The Scale gizmo is also wired but this
    // gives exact values.
    events.on('pbr.scale', (v: number) => {
        if (!currentMesh) return;
        const s = Math.max(1e-4, v);
        currentMesh.entity.setLocalScale(s, s, s);
        forceRender();
    });

    // Rotation via three Euler-angle inputs (degrees). Simpler than the arc
    // gizmo when you want a precise value.
    events.on('pbr.rotation', (e: { x: number; y: number; z: number }) => {
        if (!currentMesh) return;
        currentMesh.entity.setLocalEulerAngles(e.x, e.y, e.z);
        forceRender();
    });
};

export { registerPbrEvents };
