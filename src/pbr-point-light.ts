// A user-controllable point light for lighting inserted PBR meshes.
// Splats are not affected (their colour is baked) — the light only hits the
// StandardMaterials in the PBR mesh. A small emissive sphere shows where it is.

import {
    BLEND_NORMAL,
    Color,
    Entity,
    LIGHTFALLOFF_INVERSESQUARED,
    Mesh,
    MeshInstance,
    SphereGeometry,
    StandardMaterial,
    TranslateGizmo,
    Vec3
} from 'playcanvas';

import { Scene } from './scene';
import { Events } from './events';

type PointLightOptions = {
    enabled: boolean;
    position: { x: number; y: number; z: number };
    intensity: number;     // candela-ish
    range: number;         // 0 = unlimited
    color: { r: number; g: number; b: number };
    showHelper: boolean;
};

const DEFAULTS: PointLightOptions = {
    enabled: false,
    position: { x: 2, y: 3, z: 2 },
    intensity: 30,
    range: 0,
    color: { r: 1, g: 1, b: 1 },
    showHelper: true
};

const registerPbrPointLight = (scene: Scene, events: Events) => {
    const app: any = (scene as any).app;
    if (!app) return;

    // ── Light entity ──
    const lightEntity = new Entity('pbr-point-light');
    lightEntity.addComponent('light', {
        type: 'point',
        color: new Color(1, 1, 1),
        intensity: DEFAULTS.intensity,
        range: 100,                                  // pc has no "0 = infinite"
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    });
    lightEntity.setPosition(DEFAULTS.position.x, DEFAULTS.position.y, DEFAULTS.position.z);
    lightEntity.enabled = false;
    app.root.addChild(lightEntity);

    // ── Visible bulb marker ──
    const bulbGeom = new SphereGeometry({ radius: 0.06 });
    const bulbMesh = Mesh.fromGeometry(app.graphicsDevice, bulbGeom);
    const bulbMat = new StandardMaterial();
    bulbMat.useLighting = false;
    bulbMat.diffuse = new Color(0, 0, 0);
    bulbMat.emissive = new Color(1, 1, 1);
    bulbMat.opacity = 1.0;
    bulbMat.blendType = BLEND_NORMAL;
    bulbMat.depthTest = false;
    bulbMat.depthWrite = false;
    bulbMat.update();
    const bulbMI = new MeshInstance(bulbMesh, bulbMat);
    const gizmoLayerId = (scene as any).gizmoLayer?.id;
    const bulbEntity = new Entity('pbr-point-light-bulb');
    bulbEntity.addComponent('render', {
        meshInstances: [bulbMI],
        ...(gizmoLayerId !== undefined ? { layers: [gizmoLayerId] } : {})
    });
    bulbEntity.enabled = false;
    lightEntity.addChild(bulbEntity);

    const state: PointLightOptions = { ...DEFAULTS };
    let gizmo: TranslateGizmo | null = null;

    const attachGizmo = () => {
        if (gizmo) return;
        const cam = (scene as any).camera?.camera;
        const layer = (scene as any).gizmoLayer;
        if (!cam || !layer) return;
        const g = new TranslateGizmo(cam, layer);
        const updateSize = () => {
            const canvas = (scene as any).canvas;
            if (!canvas) return;
            g.size = 1200 / Math.max(canvas.clientWidth, canvas.clientHeight);
        };
        updateSize();
        events.on('camera.resize', updateSize);
        g.on('render:update', () => { (scene as any).forceRender = true; });
        // After a drag finishes, push the new position back to the panel so
        // the X/Y/Z numeric inputs reflect it.
        g.on('transform:end', () => {
            const p = lightEntity.getLocalPosition();
            state.position = { x: p.x, y: p.y, z: p.z };
            events.fire('pbr.pointLight.positionChanged', state.position);
        });
        g.attach([lightEntity]);
        gizmo = g;
    };

    const detachGizmo = () => {
        if (!gizmo) return;
        try { gizmo.detach(); (gizmo as any).destroy?.(); } catch (e) {}
        gizmo = null;
    };

    const sync = () => {
        const c = lightEntity.light;
        c.color = new Color(state.color.r, state.color.g, state.color.b);
        c.intensity = state.intensity;
        c.range = state.range > 0 ? state.range : 100;
        lightEntity.setLocalPosition(state.position.x, state.position.y, state.position.z);
        bulbMat.emissive = new Color(state.color.r, state.color.g, state.color.b);
        bulbMat.update();
        lightEntity.enabled = state.enabled;
        bulbEntity.enabled = state.enabled && state.showHelper;
        // Gizmo only meaningful while the light is on.
        if (state.enabled) attachGizmo(); else detachGizmo();
        (scene as any).forceRender = true;
    };

    sync();

    // ── Event wiring (panel → here) ──
    events.on('pbr.pointLight.enable',   (v: boolean) => { state.enabled = v; sync(); });
    events.on('pbr.pointLight.showHelper', (v: boolean) => { state.showHelper = v; sync(); });
    events.on('pbr.pointLight.position', (p: { x: number; y: number; z: number }) => {
        state.position = p; sync();
    });
    events.on('pbr.pointLight.intensity', (v: number) => { state.intensity = v; sync(); });
    events.on('pbr.pointLight.range',     (v: number) => { state.range = v; sync(); });
    events.on('pbr.pointLight.color',     (c: { r: number; g: number; b: number }) => {
        state.color = c; sync();
    });

    // Expose defaults so the panel can populate widget values on mount.
    events.fire('pbr.pointLight.defaults', DEFAULTS);
    // Expose the light entity so the shadow catcher can toggle castShadows.
    events.fire('pbr.pointLight.entity', lightEntity);
};

export { registerPbrPointLight };
