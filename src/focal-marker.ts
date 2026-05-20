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
        tubeRadius: 0.04,
        ringRadius: 0.5,
        segments: 64,
        sides: 16
    });
    const mesh = Mesh.fromGeometry(app.graphicsDevice, geom);
    const mat = new StandardMaterial();
    mat.useLighting = false;
    mat.diffuse = new Color(0, 0, 0);
    mat.emissive = new Color(1, 1, 1);
    mat.opacity = 1.0;
    mat.blendType = BLEND_NORMAL;
    mat.depthTest = false;   // always visible, even through geometry/splats
    mat.depthWrite = false;
    mat.update();

    const meshInstance = new MeshInstance(mesh, mat);
    // Render on the gizmo layer so it draws after all splats and isn't
    // sorted/occluded by them.
    const gizmoLayerId = (scene as any).gizmoLayer?.id;
    const entity = new Entity('focal-marker');
    entity.addComponent('render', {
        meshInstances: [meshInstance],
        ...(gizmoLayerId !== undefined ? { layers: [gizmoLayerId] } : {})
    });
    entity.enabled = false;
    app.root.addChild(entity);

    events.on('camera.focalPointPicked', (details: { position: Vec3 }) => {
        entity.setPosition(details.position);
        // Keep the ring a roughly constant on-screen size, like the gizmo.
        const camEntity = (scene as any).camera?.mainCamera;
        if (camEntity) {
            const d = entity.getPosition().distance(camEntity.getPosition());
            const s = Math.max(0.4, d * 0.18);
            entity.setLocalScale(s, s, s);
        } else {
            entity.setLocalScale(1, 1, 1);
        }
        // Leave the ring flat in the world XZ plane (lying on the surface) —
        // matches the superspl.at marker style. Skipping billboard avoids
        // edge-on flicker when the camera looks along the ring's normal.
        entity.setLocalEulerAngles(0, 0, 0);
        entity.enabled = true;
        (scene as any).forceRender = true;
    });
};

export { registerFocalMarker };
