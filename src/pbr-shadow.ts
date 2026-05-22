// Shadow catcher for the PBR mesh in the SuperSplat editor.
//
// Splats are a custom shader that doesn't participate in PlayCanvas's shadow
// pipeline — so a mesh inserted above them has nothing to receive its shadow.
// We synthesise that surface: a horizontal plane under the mesh, with a
// StandardMaterial set up so it shows only where the point light's shadow
// falls (BLEND_MULTIPLICATIVE against the splat background).
//
// Trick: useLighting=true, diffuse=white, emissive=0, useSkybox=false,
// ambient=0. The lit fragments evaluate to (1,1,1) → multiplied with the
// splat backdrop = unchanged. The shadowed fragments evaluate to (0,0,0)
// (the point light is the only source) → multiplied with the backdrop =
// dark. Strength is achieved by lerping the lit-side colour toward white,
// not by changing opacity.

import {
    BLEND_MULTIPLICATIVE,
    Color,
    Entity,
    StandardMaterial
} from 'playcanvas';

import { Scene } from './scene';
import { Events } from './events';

type ShadowState = {
    enabled: boolean;
    strength: number;       // 0..1; how dark the shadow looks vs the splat bg
    sizeMul: number;        // catcher plane size = sizeMul × max(bbox.x, bbox.z)
};

const DEFAULTS: ShadowState = {
    enabled: false,
    strength: 0.5,
    sizeMul: 2.0
};

const registerPbrShadow = (scene: Scene, events: Events) => {
    const app: any = (scene as any).app;
    if (!app) return;

    const state: ShadowState = { ...DEFAULTS };
    let plane: Entity | null = null;
    let mat: StandardMaterial | null = null;
    let currentMesh: any = null;          // PbrMesh
    let currentLight: Entity | null = null;

    const buildPlane = () => {
        if (plane) return;
        const e = new Entity('pbr-shadow-catcher');
        e.addComponent('render', { type: 'plane', castShadows: false });
        // PlayCanvas's render component renders shadows by default; explicit:
        const mi = e.render!.meshInstances[0];
        mi.castShadow = false;
        mi.receiveShadow = true;
        // Material configured for "shadow-only" via BLEND_MULTIPLICATIVE.
        const m = new StandardMaterial();
        m.useLighting = true;
        m.useSkybox = false;                       // ignore envAtlas/IBL
        m.diffuse = new Color(1, 1, 1);             // fully lit ⇒ white
        m.emissive = new Color(0, 0, 0);
        m.ambient = new Color(0, 0, 0);             // suppress scene.ambientLight
        m.opacity = 1.0;
        m.blendType = BLEND_MULTIPLICATIVE;
        m.depthWrite = false;
        m.update();
        mi.material = m;
        mat = m;
        plane = e;
        app.root.addChild(e);
        e.enabled = false;
    };

    // Position + scale the plane under the mesh's bbox bottom.
    const placePlane = () => {
        if (!plane || !currentMesh) return;
        const bound = currentMesh.worldBound;
        const radius = Math.max(bound.halfExtents.x, bound.halfExtents.z) * state.sizeMul;
        plane.setLocalScale(radius * 2, 1, radius * 2);
        plane.setLocalPosition(
            bound.center.x,
            bound.center.y - bound.halfExtents.y - 0.001,
            bound.center.z
        );
    };

    // Update the catcher's "darkness range" via tweaking the material's
    // diffuse: pure white = no darkening on lit side (subtle shadow);
    // colour < 1 = even lit pixels darken the splat bg (heavier overall).
    // strength controls **how dark the shadow gets**: 0 = invisible, 1 = full black.
    const applyStrength = () => {
        if (!mat) return;
        // Lit side stays white (no darkening of splat bg).
        mat.diffuse = new Color(1, 1, 1);
        // The shadow side becomes (1 - strength) shade — we encode this by
        // adding emissive of (1 - strength) so even fully shadowed (no diffuse
        // contribution) fragments aren't pitch-black:
        const e = 1.0 - state.strength;
        mat.emissive = new Color(e, e, e);
        mat.update();
    };

    const refresh = () => {
        if (!state.enabled || !currentMesh) {
            if (plane) plane.enabled = false;
            return;
        }
        buildPlane();
        placePlane();
        applyStrength();
        plane!.enabled = true;
        // Make sure the point light casts shadows when the catcher is on.
        if (currentLight && currentLight.light) {
            currentLight.light.castShadows = true;
            currentLight.light.shadowResolution = 1024;
        }
        (scene as any).forceRender = true;
    };

    // ── Events from the panel ──
    events.on('pbr.shadow.enable', (v: boolean) => { state.enabled = v; refresh(); });
    events.on('pbr.shadow.strength', (v: number) => { state.strength = v; refresh(); });
    events.on('pbr.shadow.size', (v: number) => { state.sizeMul = v; refresh(); });

    // ── Mesh load/unload ──
    events.on('pbr.meshChanged', (mesh: any) => {
        currentMesh = mesh;
        refresh();
    });

    // ── Point light handle (so we can flip castShadows on it) ──
    events.on('pbr.pointLight.entity', (e: Entity) => {
        currentLight = e;
        refresh();
    });

    // ── React to point light moves so the shadow keeps up ──
    events.on('pbr.pointLight.positionChanged', () => {
        if (state.enabled) (scene as any).forceRender = true;
    });

    events.fire('pbr.shadow.defaults', DEFAULTS);
};

export { registerPbrShadow };
