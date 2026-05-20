// Shows a thin white ring at the camera's focal point when the user
// double-clicks on a splat. Mirrors superspl.at's "click-to-fly-there"
// indicator so the focus target is visually obvious.

import {
    BLEND_NORMAL,
    Color,
    Entity,
    Mesh,
    MeshInstance,
    StandardMaterial,
    TorusGeometry,
    Vec3
} from 'playcanvas';

import { Scene } from './scene';
import { Events } from './events';

const registerFocalMarker = (scene: Scene, events: Events) => {
    const app: any = (scene as any).app;
    if (!app) return;

    const geom = new TorusGeometry({
        tubeRadius: 0.012,
        ringRadius: 0.18,
        segments: 64,
        sides: 12
    });
    const mesh = Mesh.fromGeometry(app.graphicsDevice, geom);
    const mat = new StandardMaterial();
    mat.useLighting = false;
    mat.diffuse = new Color(0, 0, 0);
    mat.emissive = new Color(1, 1, 1);
    mat.opacity = 0.95;
    mat.blendType = BLEND_NORMAL;
    mat.depthTest = false;   // always visible, even through geometry
    mat.depthWrite = false;
    mat.update();

    const meshInstance = new MeshInstance(mesh, mat);
    const entity = new Entity('focal-marker');
    entity.addComponent('render', { meshInstances: [meshInstance] });
    entity.enabled = false;
    app.root.addChild(entity);

    events.on('camera.focalPointPicked', (details: { position: Vec3 }) => {
        entity.setPosition(details.position);
        // Scale with distance to keep the ring a roughly constant on-screen
        // size — same trick as the transform gizmo.
        const cam = (scene as any).camera?.entity;
        if (cam) {
            const d = entity.getPosition().distance(cam.getPosition());
            const s = Math.max(0.3, d * 0.05);
            entity.setLocalScale(s, s, s);
        }
        entity.enabled = true;
        (scene as any).forceRender = true;
    });
};

export { registerFocalMarker };
