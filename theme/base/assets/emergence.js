/* Emergence · 涌现 — animated velocity-field background for the base theme.
 *
 * A divergence-free field v = curl(psi) advects a cloud of particles; each
 * particle draws one short segment per frame into an additively blended
 * canvas that fades a little every tick, so the motion leaves soft trails.
 *
 * The canvas is fixed behind the page (`#emergence` in base.html, styled in
 * style.css) and is pointer-transparent, so text selection, links and
 * scrolling are untouched. Dark mode paints an additive glow on a near-black
 * field; light mode paints the same field as pale ink, because additive light
 * is invisible on a white page.
 *
 * Adapted from the standalone "Emergence" demo for a page background. The
 * field, the particle update, the hue bucketing and the single-path-per-bucket
 * draw are the demo's; only these are new: the palette follows the light/dark
 * toggle, pointer steering is disabled on touch screens, and
 * `prefers-reduced-motion` gets one static frame instead of the loop (which is
 * a requestAnimationFrame one, so browsers already pause it for hidden tabs).
 * Everything is wrapped in an IIFE and the only global it touches is the
 * canvas element itself.
 */
(() => {
    'use strict';

    const canvas = document.getElementById('emergence');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COARSE = matchMedia('(pointer: coarse)').matches;

    /* ══════════════════════════════════════════
       1. 势场 psi(x, y, t)
       速度场取 curl(psi)：v = ( ∂psi/∂y , -∂psi/∂x )
       无散度 → 天然涡旋，粒子不堆积
       ══════════════════════════════════════════ */
    const S = 0.0055;              // spatial frequency

    function psi(x, y, t) {
        const a = x * S;
        const b = y * S;
        return (
            Math.sin(a * 1.35 + t * 0.40) * Math.cos(b * 1.15 - t * 0.34) +
            0.62 * Math.sin((a + b) * 0.92 + t * 0.26) +
            0.44 * Math.cos((a - b * 1.30) * 0.85 - t * 0.31) +
            0.30 * Math.sin(a * 2.15 - b * 1.85 + t * 0.48)
        );
    }

    const EPS = 1.5;               // finite-difference step
    const NORM = 0.009;            // field-strength normalisation

    /* ══════════════════════════════════════════
       2. Sizing
       ══════════════════════════════════════════ */
    let W = 0;
    let H = 0;
    let DPR = 1;

    const particles = [];

    class Particle {
        constructor() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.px = this.x;
            this.py = this.y;
            this.vx = 0;
            this.vy = 0;
            this.bucket = 0;
        }
    }

    const viewport = { w: 0, h: 0 };

    /* The demo's own budget: one particle per ~1700 px², floored and capped. */
    function density() {
        return 1700;
    }

    function resize() {
        viewport.w = window.innerWidth;
        viewport.h = window.innerHeight;
        W = viewport.w;
        H = viewport.h;
        DPR = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.max(1, Math.round(W * DPR));
        canvas.height = Math.max(1, Math.round(H * DPR));
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        clear();

        const target = Math.round(Math.min(2200, Math.max(320, (W * H) / density())));
        while (particles.length < target) particles.push(new Particle());
        while (particles.length > target) particles.pop();
    }

    /* Reset the surface to the palette's own colour. Needed on resize (the
       backing store is wiped) and on a theme flip (the old palette's trails
       would otherwise fade through a long grey smear). */
    function clear() {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgb(${pal.bg[0]}, ${pal.bg[1]}, ${pal.bg[2]})`;
        ctx.fillRect(0, 0, W, H);
    }

    /* ══════════════════════════════════════════
       3. Pointer — a gentle vortex
       ══════════════════════════════════════════ */
    const pointer = { x: -9999, y: -9999, active: false };

    window.addEventListener('pointermove', (e) => {
        // On touch screens the finger is scrolling, not steering.
        if (COARSE && e.pointerType !== 'mouse') return;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
        if (COARSE && e.pointerType !== 'mouse') return;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
        pointer.active = false;
        pointer.x = pointer.y = -9999;
    });

    /* ══════════════════════════════════════════
       4. Palette — the page's theme decides it
       ══════════════════════════════════════════ */
    // `ink` is the stroke lightness, `alpha` its opacity, `fade` how fast the
    // trails dissolve back into `bg` and `width` the stroke weight.
    //
    // `fade`, `width` and the particle budget below are the demo's own, so each
    // particle stays the same short, fine dash it is there: a 1.05px stroke
    // over a 0.052 wash. The only change is `alpha` — a hairline at 0.27 never
    // quite reaches full colour, so on a page (behind a surface and a veil) the
    // field reads as haze. A firmer stroke at the same weight makes each dash
    // read as one solid mark without making it any heavier.
    // Light mode cannot use additive light on a white page, so it paints dark
    // ink over white instead — see `.emergence` in style.css.
    const PALETTES = {
        dark: {
            buckets: 18, hueMin: 182, hueMax: 306, bg: [5, 6, 12],
            ink: 63, alpha: 0.45, blend: 'lighter', fade: 0.052, width: 1.05,
        },
        // The same stroke, as dark ink on the page's white surface.
        light: {
            buckets: 18, hueMin: 196, hueMax: 322, bg: [255, 255, 255],
            ink: 30, alpha: 0.24, blend: 'source-over', fade: 0.09, width: 1.05,
        },
    };

    const wantsDark = () => (document.documentElement.dataset.theme
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';

    let pal = wantsDark() ? PALETTES.dark : PALETTES.light;

    /* Repaint in the other palette when the theme toggle flips. The veil in
       style.css switches colour on its own, from the same `data-theme`. */
    function sync() {
        const next = wantsDark() ? PALETTES.dark : PALETTES.light;
        if (next === pal) return;
        pal = next;
        resize();          // repaints the new palette's field from scratch
        if (REDUCED) paintStill();
    }

    /* ══════════════════════════════════════════
       5. Main loop
       ══════════════════════════════════════════ */
    let time = 0;
    let last = 0;

    function step(now) {
        requestAnimationFrame(step);

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        time += dt;

        draw(dt);
    }

    /* ══════════════════════════════════════════
       6. One frame
       ══════════════════════════════════════════ */
    function draw(dt) {
        /* ---------- trail fade ---------- */
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${pal.bg[0]}, ${pal.bg[1]}, ${pal.bg[2]}, ${pal.fade})`;
        ctx.fillRect(0, 0, W, H);

        /* ---------- update ---------- */
        const k = 1 - Math.exp(-dt * 5.0);
        const list = particles;
        const count = list.length;

        for (let i = 0; i < count; i++) {
            const p = list[i];
            const x = p.x;
            const y = p.y;

            // central differences of the potential
            const gx = (psi(x + EPS, y, time) - psi(x - EPS, y, time)) / (2 * EPS);
            const gy = (psi(x, y + EPS, time) - psi(x, y - EPS, time)) / (2 * EPS);

            // curl: v = ( ∂psi/∂y , -∂psi/∂x )
            let fx = gy;
            let fy = -gx;

            const len = Math.sqrt(fx * fx + fy * fy) || 1e-9;
            const mag = Math.min(len / NORM, 1);

            // slow 25px/s → fast 200px/s
            const speed = 25 + 175 * mag * mag;
            fx = (fx / len) * speed;
            fy = (fy / len) * speed;

            // pointer vortex: radial push + tangential swirl
            if (pointer.active) {
                const dx = x - pointer.x;
                const dy = y - pointer.y;
                const d2 = dx * dx + dy * dy;
                const R = 220;
                if (d2 < R * R) {
                    const d = Math.sqrt(d2) || 1e-6;
                    const fall = 1 - d / R;
                    const f = fall * fall;
                    const nx = dx / d;
                    const ny = dy / d;
                    const push = 300 * f;
                    const swirl = 260 * f;
                    fx += nx * push - ny * swirl;
                    fy += ny * push + nx * swirl;
                }
            }

            // ease towards the field velocity
            p.vx += (fx - p.vx) * k;
            p.vy += (fy - p.vy) * k;

            p.px = x;
            p.py = y;
            p.x = x + p.vx * dt;
            p.y = y + p.vy * dt;

            // wrap around; reset the previous point so no line crosses the page
            if (p.x < -30) { p.x = W + 30; p.px = p.x; }
            else if (p.x > W + 30) { p.x = -30; p.px = p.x; }
            if (p.y < -30) { p.y = H + 30; p.py = p.y; }
            else if (p.y > H + 30) { p.y = -30; p.py = p.y; }

            // hue: position and time together
            const hueT = 0.5 + 0.5 * Math.sin(p.y * 0.0021 + p.x * 0.0011 + time * 0.22);
            p.bucket = Math.min(pal.buckets - 1, (hueT * pal.buckets) | 0);
        }

        /* ---------- render ---------- */
        // One path per hue bucket, so the whole cloud costs a couple of dozen
        // draw calls rather than one per particle.
        ctx.globalCompositeOperation = pal.blend;
        ctx.lineCap = 'round';
        ctx.lineWidth = pal.width;

        for (let b = 0; b < pal.buckets; b++) {
            ctx.beginPath();
            let has = false;

            for (let i = 0; i < count; i++) {
                const p = list[i];
                if (p.bucket !== b) continue;
                ctx.moveTo(p.px, p.py);
                ctx.lineTo(p.x, p.y);
                has = true;
            }
            if (!has) continue;

            const hue = pal.hueMin + (pal.hueMax - pal.hueMin) * ((b + 0.5) / pal.buckets);
            ctx.strokeStyle = `hsla(${hue.toFixed(1)}, 100%, ${pal.ink}%, ${pal.alpha})`;
            ctx.stroke();
        }
    }

    /* ══════════════════════════════════════════
       7. Lifecycle
       ══════════════════════════════════════════ */
    // The loop runs on requestAnimationFrame, which browsers already pause for
    // hidden tabs, and `step()` clamps dt so a long gap cannot jump the field.
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            if (REDUCED) paintStill();
        }, 150);
    });

    /* Reduced motion: one static, dimmed frame — texture without movement. */
    function paintStill() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x = Math.random() * W;
            p.y = Math.random() * H;
            p.px = p.x - 6;
            p.py = p.y - 4;
            p.bucket = (Math.random() * pal.buckets) | 0;
        }
        draw(0.016);
    }

    // Follow the theme toggle in base.html (and the OS scheme).
    new MutationObserver(sync).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);

    resize();

    if (REDUCED) {
        paintStill();                     // texture without movement
    } else {
        last = performance.now();
        requestAnimationFrame(step);
    }
})();
