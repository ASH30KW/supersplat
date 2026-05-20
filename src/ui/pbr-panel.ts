// Panel for inserting a PBR mesh (GLB) into the splat scene and lighting it
// with a cubemap-based IBL. Also lets the user load a 3DGS room PLY as the
// surrounding splat scene. Mirrors the structure of view-panel.ts.

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

        // ── Room (3DGS splats) ──
        const roomRow = new Container({ class: 'view-panel-row' });
        roomRow.append(new Label({ text: 'Room', class: 'view-panel-row-label' }));
        const roomSelect = new SelectInput({
            class: 'view-panel-row-picker',
            defaultValue: 'Coastal_Loft_Living',
            options: [{ v: 'Coastal_Loft_Living', t: 'Coastal_Loft_Living' }]
        });
        roomRow.append(roomSelect);
        this.append(roomRow);

        const roomLoadRow = new Container({ class: 'view-panel-row' });
        const roomLoadBtn = new Button({ text: 'Load room', class: 'view-panel-row-picker' });
        roomLoadRow.append(roomLoadBtn);
        this.append(roomLoadRow);

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

        // ── Cubemap ──
        const cubeRow = new Container({ class: 'view-panel-row' });
        cubeRow.append(new Label({ text: 'Cubemap', class: 'view-panel-row-label' }));
        const cubeSelect = new SelectInput({
            class: 'view-panel-row-picker',
            defaultValue: 'Coastal_Loft_Living_cubemap',
            options: [{ v: 'Coastal_Loft_Living_cubemap', t: 'Coastal_Loft_Living_cubemap' }]
        });
        cubeRow.append(cubeSelect);
        this.append(cubeRow);

        // ── Load PBR object ──
        const loadRow = new Container({ class: 'view-panel-row' });
        const loadBtn = new Button({ text: 'Load PBR object', class: 'view-panel-row-picker' });
        loadRow.append(loadBtn);
        this.append(loadRow);

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
        roomLoadBtn.on('click', () => {
            events.fire('pbr.loadRoom', { room: roomSelect.value });
        });
        loadBtn.on('click', () => {
            events.fire('pbr.load', {
                glb: glbSelect.value,
                cubemap: cubeSelect.value
            });
        });
        roughSlider.on('change', (v: number) => events.fire('pbr.roughness', v));
        metalSlider.on('change', (v: number) => events.fire('pbr.metallic', v));
        expSlider.on('change', (v: number) => events.fire('pbr.exposure', v));
        resetBtn.on('click', () => events.fire('pbr.reset'));

        // When pbr-events finishes loading a GLB it tells us its defaults so the
        // sliders can snap to them — same UX as the standalone PBR viewer.
        events.on('pbr.glbDefaults', (d: { roughness: number; metallic: number }) => {
            roughSlider.value = d.roughness;
            metalSlider.value = d.metallic;
        });

        // Populate dropdowns from /pbr-assets.
        events.on('pbr.options', (opts: { glbs: string[], cubemaps: string[], rooms?: string[] }) => {
            glbSelect.options = opts.glbs.map(n => ({ v: n, t: n }));
            cubeSelect.options = opts.cubemaps.map(n => ({ v: n, t: n }));
            roomSelect.options = (opts.rooms || []).map(n => ({ v: n, t: n }));
            if (opts.glbs.length) {
                glbSelect.value = opts.glbs.includes('chair') ? 'chair' : opts.glbs[0];
            }
            if (opts.cubemaps.length) {
                cubeSelect.value = opts.cubemaps.includes('Coastal_Loft_Living_cubemap')
                    ? 'Coastal_Loft_Living_cubemap' : opts.cubemaps[0];
            }
            if ((opts.rooms || []).length) {
                roomSelect.value = (opts.rooms || []).includes('Coastal_Loft_Living')
                    ? 'Coastal_Loft_Living' : (opts.rooms as string[])[0];
            }
        });
    }
}

export { PbrPanel };
