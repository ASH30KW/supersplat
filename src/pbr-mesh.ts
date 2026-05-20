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
    // Snapshot of the GLB-shipped material values so "Reset to GLB defaults"
    // can restore them.
    private _glbDefaults: { gloss: number; metalness: number; useMetalness: boolean }[] = [];

    constructor(asset: Asset) {
        super(ElementType.model);
        this.asset = asset;
        // ContainerHandler's resource has .instantiateRenderEntity()
        const container: any = asset.resource;
        const glbEntity: Entity = container.instantiateRenderEntity();
        glbEntity.name = `pbr-mesh-glb:${asset.name}`;
        this._collectMaterials(glbEntity);
        this._snapshotDefaults();

        // Wrap the GLB in a pivot entity at its bounding-box center so the
        // gizmo, rotation, and scale all act around the visible center of the
        // mesh rather than the (often off-center) GLB authored origin.
        this.entity = new Entity(`pbr-mesh:${asset.name}`);
        this.entity.addChild(glbEntity);
        const center = this._computeBoundsCenter(glbEntity);
        glbEntity.setLocalPosition(-center.x, -center.y, -center.z);
    }

    /** Mean of all mesh-instance AABB centers (world == local here since the
     *  entity hasn't been added to a transformed parent yet). */
    private _computeBoundsCenter(root: Entity): Vec3 {
        const bound = new BoundingBox();
        let first = true;
        const stack: Entity[] = [root];
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
        return first ? new Vec3(0, 0, 0) : bound.center.clone();
    }

    private _snapshotDefaults() {
        this._glbDefaults = this._materials.map(m => ({
            gloss: m.gloss,
            metalness: m.metalness,
            useMetalness: m.useMetalness,
        }));
    }

    /** Returns the GLB's first material's defaults (for showing in sliders). */
    getGlbDefaults(): { roughness: number; metallic: number } {
        if (this._glbDefaults.length === 0) return { roughness: 0.5, metallic: 0 };
        const d = this._glbDefaults[0];
        return { roughness: 1 - d.gloss, metallic: d.useMetalness ? d.metalness : 0 };
    }

    /** Restore each material to its original GLB-shipped values. */
    resetToGlbDefaults() {
        for (let i = 0; i < this._materials.length && i < this._glbDefaults.length; i++) {
            const m = this._materials[i];
            const d = this._glbDefaults[i];
            m.gloss = d.gloss;
            m.metalness = d.metalness;
            m.useMetalness = d.useMetalness;
            (m as any).update();
        }
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
