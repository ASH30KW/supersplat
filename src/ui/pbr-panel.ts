// Panel for inserting a PBR mesh (GLB) into the splat scene and lighting it
// with the cubemap that matches the loaded 3DGS room. Selections trigger
// loads automatically — no explicit Load buttons.

import { BooleanInput, Button, ColorPicker, Container, Label, NumericInput, SelectInput, SliderInput, VectorInput } from '@playcanvas/pcui';

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

        // Translation stays on the 3D gizmo (best UX for positioning).
        // Rotation + Scale move to manual numeric inputs below — more precise
        // than dragging arcs or boxes.
        events.fire('pbr.gizmoMode', 'translate');

        // ── Rotation (Euler degrees, X / Y / Z) ──
        const rotRow = new Container({ class: 'view-panel-row' });
        rotRow.append(new Label({ text: 'Rotation', class: 'view-panel-row-label' }));
        const rotInput = new VectorInput({
            class: 'view-panel-row-picker',
            dimensions: 3,
            precision: 0,
            step: 1,
            placeholder: ['X', 'Y', 'Z'],
            value: [0, 0, 0]
        });
        rotRow.append(rotInput);
        this.append(rotRow);

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

        // Uniform scale — type any positive number, no slider clamp.
        const scaleRow = new Container({ class: 'view-panel-row' });
        scaleRow.append(new Label({ text: 'Scale', class: 'view-panel-row-label' }));
        const scaleInput = new NumericInput({
            class: 'view-panel-row-picker',
            value: 1.0, min: 0.001, max: 10000, precision: 3
        });
        scaleRow.append(scaleInput);
        this.append(scaleRow);

        // ── Point light (extra discrete light source for the PBR mesh) ──
        const plHeader = new Label({ text: '— Point Light —', class: 'pbr-section-label' });
        this.append(plHeader);

        const plEnableRow = new Container({ class: 'view-panel-row' });
        plEnableRow.append(new Label({ text: 'Enable', class: 'view-panel-row-label' }));
        const plEnable = new BooleanInput({ class: 'view-panel-row-picker', type: 'toggle', value: false });
        plEnableRow.append(plEnable);
        this.append(plEnableRow);

        const plPosRow = new Container({ class: 'view-panel-row' });
        plPosRow.append(new Label({ text: 'Position', class: 'view-panel-row-label' }));
        const plPos = new VectorInput({
            class: 'view-panel-row-picker',
            dimensions: 3,
            precision: 2,
            placeholder: ['X', 'Y', 'Z'],
            value: [2, 3, 2]
        });
        plPosRow.append(plPos);
        this.append(plPosRow);

        const plIntRow = new Container({ class: 'view-panel-row' });
        plIntRow.append(new Label({ text: 'Intensity', class: 'view-panel-row-label' }));
        const plInt = new SliderInput({
            class: 'view-panel-row-picker', min: 0, max: 200, value: 30, precision: 1
        });
        plIntRow.append(plInt);
        this.append(plIntRow);

        const plRangeRow = new Container({ class: 'view-panel-row' });
        plRangeRow.append(new Label({ text: 'Range', class: 'view-panel-row-label' }));
        const plRange = new SliderInput({
            class: 'view-panel-row-picker', min: 0, max: 50, value: 0, precision: 1
        });
        plRangeRow.append(plRange);
        this.append(plRangeRow);

        const plColorRow = new Container({ class: 'view-panel-row' });
        plColorRow.append(new Label({ text: 'Color', class: 'view-panel-row-label' }));
        const plColor = new ColorPicker({
            class: 'view-panel-row-picker',
            value: [1, 1, 1]
        });
        plColorRow.append(plColor);
        this.append(plColorRow);

        const plHelperRow = new Container({ class: 'view-panel-row' });
        plHelperRow.append(new Label({ text: 'Show bulb', class: 'view-panel-row-label' }));
        const plHelper = new BooleanInput({ class: 'view-panel-row-picker', type: 'toggle', value: true });
        plHelperRow.append(plHelper);
        this.append(plHelperRow);

        plEnable.on('change', (v: boolean) => events.fire('pbr.pointLight.enable', v));
        plHelper.on('change', (v: boolean) => events.fire('pbr.pointLight.showHelper', v));
        plPos.on('change', (v: number[]) => events.fire('pbr.pointLight.position',
            { x: v[0] || 0, y: v[1] || 0, z: v[2] || 0 }));
        plInt.on('change',   (v: number) => events.fire('pbr.pointLight.intensity', v));
        plRange.on('change', (v: number) => events.fire('pbr.pointLight.range', v));
        plColor.on('change', (rgb: number[]) => events.fire('pbr.pointLight.color',
            { r: rgb[0] ?? 1, g: rgb[1] ?? 1, b: rgb[2] ?? 1 }));

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
        scaleInput.on('change', (v: number) => events.fire('pbr.scale', v));
        rotInput.on('change', (v: number[]) => {
            events.fire('pbr.rotation', { x: v[0] || 0, y: v[1] || 0, z: v[2] || 0 });
        });
        resetBtn.on('click', () => events.fire('pbr.reset'));

        // Reset scale + rotation to identity whenever a fresh GLB loads.
        events.on('pbr.glbLoaded', () => {
            scaleInput.value = 1.0;
            rotInput.value = [0, 0, 0];
        });

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
