// Panel for inserting a PBR mesh (GLB) into the splat scene and lighting it
// with the cubemap that matches the loaded 3DGS room. Selections trigger
// loads automatically — no explicit Load buttons.

import { Button, Container, Label, SelectInput, SliderInput } from '@playcanvas/pcui';

import { Events } from '../events';

class PbrPanel extends Container {
    constructor(events: Events, args: any = {}) {
        super({
            ...args,
            id: 'pbr-panel',
            class: 'panel',
            hidden: false
        });

        // Swallow pointer/wheel events so they don't reach the 3D viewport.
        ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'dblclick'].forEach((n) => {
            this.dom.addEventListener(n, (e: Event) => e.stopPropagation());
        });

        const header = new Container({ class: 'panel-header' });
        const icon = new Label({ text: '', class: 'panel-header-icon' });
        const label = new Label({ text: 'PBR Object', class: 'panel-header-label' });
        header.append(icon);
        header.append(label);
        this.append(header);

        // ── Room (3DGS splats + matching cubemap) ──
        const roomRow = new Container({ class: 'view-panel-row' });
        roomRow.append(new Label({ text: 'Room', class: 'view-panel-row-label' }));
        const roomSelect = new SelectInput({
            class: 'view-panel-row-picker',
            defaultValue: 'Coastal_Loft_Living',
            options: [{ v: 'Coastal_Loft_Living', t: 'Coastal_Loft_Living' }]
        });
        roomRow.append(roomSelect);
        this.append(roomRow);

        // ── Object (GLB) ──
        const glbRow = new Container({ class: 'view-panel-row' });
        glbRow.append(new Label({ text: 'GLB', class: 'view-panel-row-label' }));
        const glbSelect = new SelectInput({
            class: 'view-panel-row-picker',
            defaultValue: 'chair',
            options: [{ v: 'chair', t: 'chair' }]
        });
        glbRow.append(glbSelect);
        this.append(glbRow);

        // ── Transform gizmo mode (move / rotate / scale) ──
        const gizmoRow = new Container({ class: 'view-panel-row' });
        gizmoRow.append(new Label({ text: 'Transform', class: 'view-panel-row-label' }));
        const gizmoBtns = new Container({ class: ['view-panel-row-picker', 'pbr-gizmo-row'] });
        const moveBtn  = new Button({ text: 'Move',   class: ['pbr-gizmo-btn', 'pbr-gizmo-active'] });
        const rotBtn   = new Button({ text: 'Rotate', class: 'pbr-gizmo-btn' });
        const scaleBtn = new Button({ text: 'Scale',  class: 'pbr-gizmo-btn' });
        gizmoBtns.append(moveBtn);
        gizmoBtns.append(rotBtn);
        gizmoBtns.append(scaleBtn);
        gizmoRow.append(gizmoBtns);
        this.append(gizmoRow);
        const pickGizmo = (mode: 'translate' | 'rotate' | 'scale', active: any) => {
            for (const b of [moveBtn, rotBtn, scaleBtn]) b.class.remove('pbr-gizmo-active');
            active.class.add('pbr-gizmo-active');
            events.fire('pbr.gizmoMode', mode);
        };
        moveBtn.on('click', () => pickGizmo('translate', moveBtn));
        rotBtn.on('click', () => pickGizmo('rotate', rotBtn));
        scaleBtn.on('click', () => pickGizmo('scale', scaleBtn));

        // ── Sliders ──
        const roughRow = new Container({ class: 'view-panel-row' });
        roughRow.append(new Label({ text: 'Roughness', class: 'view-panel-row-label' }));
        const roughSlider = new SliderInput({
            class: 'view-panel-row-picker', min: 0, max: 1, value: 0.5, precision: 2
        });
        roughRow.append(roughSlider);
        this.append(roughRow);

        const metalRow = new Container({ class: 'view-panel-row' });
        metalRow.append(new Label({ text: 'Metallic', class: 'view-panel-row-label' }));
        const metalSlider = new SliderInput({
            class: 'view-panel-row-picker', min: 0, max: 1, value: 0.0, precision: 2
        });
        metalRow.append(metalSlider);
        this.append(metalRow);

        const expRow = new Container({ class: 'view-panel-row' });
        expRow.append(new Label({ text: 'Exposure', class: 'view-panel-row-label' }));
        const expSlider = new SliderInput({
            class: 'view-panel-row-picker', min: 0.1, max: 3, value: 1.0, precision: 2
        });
        expRow.append(expSlider);
        this.append(expRow);

        // ── Reset to GLB defaults ──
        const resetRow = new Container({ class: 'view-panel-row' });
        const resetBtn = new Button({
            text: 'Reset to GLB defaults',
            class: 'view-panel-row-picker'
        });
        resetRow.append(resetBtn);
        this.append(resetRow);

        // ── Wire events ──
        // Dropdown changes trigger loads immediately; no separate buttons.
        roomSelect.on('change', (v: string) => {
            if (v) events.fire('pbr.selectRoom', { room: v });
        });
        glbSelect.on('change', (v: string) => {
            if (v) events.fire('pbr.selectGlb', { glb: v });
        });

        roughSlider.on('change', (v: number) => events.fire('pbr.roughness', v));
        metalSlider.on('change', (v: number) => events.fire('pbr.metallic', v));
        expSlider.on('change', (v: number) => events.fire('pbr.exposure', v));
        resetBtn.on('click', () => events.fire('pbr.reset'));

        // Snap the sliders to the GLB's shipped defaults right after a load.
        events.on('pbr.glbDefaults', (d: { roughness: number; metallic: number }) => {
            roughSlider.value = d.roughness;
            metalSlider.value = d.metallic;
        });

        // Populate dropdowns from /pbr-assets.
        events.on('pbr.options', (opts: { glbs: string[], cubemaps: string[], rooms?: string[] }) => {
            glbSelect.options = opts.glbs.map(n => ({ v: n, t: n }));
            roomSelect.options = (opts.rooms || []).map(n => ({ v: n, t: n }));
            if (opts.glbs.length) {
                glbSelect.value = opts.glbs.includes('chair') ? 'chair' : opts.glbs[0];
            }
            if ((opts.rooms || []).length) {
                roomSelect.value = (opts.rooms as string[]).includes('Coastal_Loft_Living')
                    ? 'Coastal_Loft_Living' : (opts.rooms as string[])[0];
            }
        });
    }
}

export { PbrPanel };
