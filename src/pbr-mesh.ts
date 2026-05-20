// A PBR mesh element (GLB) that lives alongside Gaussian splats in the scene.
// Wraps a PlayCanvas Entity loaded from a GLB Asset; lets us tweak roughness /
// metallic / cubemap IBL at runtime.

import {
    Asset,
    BoundingBox,
    Entity,
    StandardMaterial,
    Vec3
} from 'playcanvas';

import { Element, ElementType } from './element';

class PbrMesh extends Element {
    asset: Asset;
    entity: Entity;
    private _materials: StandardMaterial[] = [];

    constructor(asset: Asset) {
        super(ElementType.model);
        this.asset = asset;
        // ContainerHandler's resource has .instantiateRenderEntity()
        const container: any = asset.resource;
        this.entity = container.instantiateRenderEntity();
        this.entity.name = `pbr-mesh:${asset.name}`;
        this._collectMaterials(this.entity);
    }

    private _collectMaterials(entity: Entity) {
        // Walk the spawned hierarchy and gather every render mesh's material so
        // the panel's sliders can update them all in lock-step.
        const stack = [entity];
        while (stack.length) {
            const e = stack.pop()!;
            const render = e.render;
            if (render) {
                for (const meshInstance of render.meshInstances) {
                    const m = meshInstance.material as StandardMaterial;
                    if (m && (m as any).useSkybox !== undefined) {
                        this._materials.push(m);
                    }
                }
            }
            for (const child of e.children) {
                stack.push(child as Entity);
            }
        }
    }

    add() {
        this.scene.contentRoot.addChild(this.entity);
    }

    remove() {
        this.scene.contentRoot.removeChild(this.entity);
    }

    destroy() {
        super.destroy();
        this.entity.destroy();
    }

    moveTo(position: Vec3) {
        this.entity.setLocalPosition(position);
    }

    // ── PBR controls ───────────────────────────────────────────────────────────
    setRoughness(v: number) {
        for (const m of this._materials) {
            m.gloss = 1 - v;   // PlayCanvas StandardMaterial uses "gloss" (1 - roughness)
            (m as any).update();
        }
    }

    setMetallic(v: number) {
        for (const m of this._materials) {
            m.metalness = v;
            m.useMetalness = true;
            (m as any).update();
        }
    }

    get worldBound(): BoundingBox {
        // Aggregate bounds from each mesh instance.
        const bound = new BoundingBox();
        let first = true;
        const stack = [this.entity];
        while (stack.length) {
            const e = stack.pop()!;
            const render = e.render;
            if (render) {
                for (const mi of render.meshInstances) {
                    if (first) {
                        bound.copy(mi.aabb);
                        first = false;
                    } else {
                        bound.add(mi.aabb);
                    }
                }
            }
            for (const child of e.children) stack.push(child as Entity);
        }
        return bound;
    }
}

export { PbrMesh };
