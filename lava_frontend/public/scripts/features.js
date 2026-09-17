/* Four looping vignettes, one per product surface. */

import { LADA_PIXELS, buildLadaMark, ladaMark } from './lada-mark.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function svg(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
}

/* ------------------------------------------------------------------ *
 * /l-ada: a staked core sending liquid claims outward
 * ------------------------------------------------------------------ */
const STAKE = { cx: 130, cy: 120, rings: 3, cycle: 10 };

function cardStake() {
  const heart = document.getElementById('stakeHeart');
  heart.appendChild(ladaMark('#ff8a63', 3.1));

  const host = document.getElementById('stakeRings');
  const rings = [];
  for (let i = 0; i < STAKE.rings; i++) {
    const ring = svg('circle', {
      cx: STAKE.cx, cy: STAKE.cy, r: 108,
      fill: 'none',
      stroke: 'rgba(255,214,180,0.5)',
      'stroke-width': 1.25,
      'stroke-dasharray': '3 7',
    });
    host.appendChild(ring);
    rings.push(ring);
  }

  if (reduced) {
    gsap.set(rings, { scale: 1, opacity: 0.5, svgOrigin: `${STAKE.cx} ${STAKE.cy}` });
    return;
  }

  const { cycle } = STAKE;
  rings.forEach((ring, i) => {
    gsap.timeline({ repeat: -1, delay: (i * cycle) / STAKE.rings })
      .fromTo(ring,
        { scale: 0.3, opacity: 0, svgOrigin: `${STAKE.cx} ${STAKE.cy}` },
        { scale: 1, duration: cycle, ease: 'none' }, 0)
      .to(ring, { opacity: 1, duration: cycle * 0.2, ease: 'none' }, 0)
      .to(ring, { opacity: 0, duration: cycle * 0.5, ease: 'none' }, cycle * 0.5);
  });

  /* The core breathes, and the halo flares with it. */
  gsap.timeline({ repeat: -1 })
    .to('#stakeHeart', { scale: 1.05, duration: 1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
    .to('#stakeHeart', { scale: 1, duration: 2.33, ease: 'sine.inOut' });

  gsap.timeline({ repeat: -1 })
    .fromTo('#stakeGlow', { opacity: 0.15 }, { opacity: 0.9, duration: 1, ease: 'sine.inOut' })
    .to('#stakeGlow', { opacity: 0.15, duration: 2.33, ease: 'sine.inOut' });
}

/* ------------------------------------------------------------------ *
 * /yield: the redemption rate climbing epoch by epoch
 * ------------------------------------------------------------------ */
const YIELD = { points: 16, start: 1, gain: 0.042, floor: 128, ceil: 34 };

function ratePoints() {
  const out = [];
  for (let i = 0; i < YIELD.points; i++) {
    const t = i / (YIELD.points - 1);
    /* A gentle wobble on a rising trend, so it reads as real epoch data. */
    const wobble = Math.sin(i * 1.7) * 0.0022 + Math.sin(i * 0.6) * 0.0014;
    const rate = YIELD.start + YIELD.gain * t + (i ? wobble : 0);
    out.push({
      x: 14 + t * 232,
      y: YIELD.floor - ((rate - YIELD.start) / YIELD.gain) * (YIELD.floor - YIELD.ceil),
      rate,
    });
  }
  return out;
}

function cardYield() {
  const pts = ratePoints();
  const line = document.getElementById('rateLine');
  const area = document.getElementById('rateArea');
  const head = document.getElementById('rateHead');
  const readout = document.getElementById('rateValue');

  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  line.setAttribute('d', d);
  area.setAttribute('d', `${d} L${pts.at(-1).x.toFixed(1)},150 L${pts[0].x.toFixed(1)},150 Z`);

  const bars = document.getElementById('rateBars');
  pts.forEach((p, i) => {
    const h = 16 + ((Math.sin(i * 2.1) + 1) / 2) * 22 + i * 1.1;
    bars.appendChild(svg('rect', {
      x: p.x - 4.5, y: 150 - h, width: 9, height: h, rx: 2, fill: 'url(#barGrad)',
    }));
  });

  const length = line.getTotalLength();
  const last = pts.at(-1).rate;

  if (reduced) {
    gsap.set(head, { x: pts.at(-1).x, y: pts.at(-1).y, xPercent: 0 });
    readout.textContent = `${last.toFixed(4)} ADA`;
    return;
  }

  const counter = { value: YIELD.start };

  gsap.timeline({ repeat: -1, repeatDelay: 0.25 })
    .from(bars.children, {
      scaleY: 0, transformOrigin: '50% 100%', duration: 0.5,
      stagger: 0.045, ease: 'power2.out',
    })
    .fromTo(line,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2.4, ease: 'none' }, 0.2)
    .fromTo(area, { opacity: 0 }, { opacity: 1, duration: 1.4 }, 0.6)
    .fromTo(head,
      { opacity: 0 },
      {
        opacity: 1, duration: 2.4, ease: 'none',
        motionPath: { path: '#rateLine', autoRotate: false },
      }, 0.2)
    .to(counter, {
      value: last, duration: 2.4, ease: 'none',
      onUpdate: () => { readout.textContent = `${counter.value.toFixed(4)} ADA`; },
    }, 0.2)
    /* Hold the finished chart, then clear quickly so the loop is barely felt. */
    .to({}, { duration: 2.8 })
    .to([line, area, head, ...bars.children], { opacity: 0, duration: 0.45 });
}

/* ------------------------------------------------------------------ *
 * /defi: the venues L-ADA plugs into
 * ------------------------------------------------------------------ */
const ICONS = [
  'assets/sundae.png',
  'assets/midnight.png',
  'assets/indigo.png',
  'assets/swoosh.png',
  'assets/fldt.png',
  'assets/minswap.png',
  'assets/usdc.png',
];

/*
 * Partner icons lead; L-ADA shows up only every few chips so it doesn't dominate.
 */
function scatterRow(offset) {
  const lavaAt = { 0: 3, 2: 5, 4: 1 }[offset] ?? 3;
  const row = [];
  let icon = offset;
  for (let i = 0; i < 8; i++) {
    if (i === lavaAt) {
      row.push(['lada']);
      continue;
    }
    row.push(['icon', ICONS[icon % ICONS.length]]);
    icon++;
  }
  return row;
}

function ladaChip() {
  const chip = document.createElement('div');
  chip.className = 'chip chip--lada';

  const holder = svg('svg', { viewBox: '0 0 15 15' });
  const group = svg('g', { fill: '#ff8a63' });
  LADA_PIXELS.forEach((row, y) => {
    let run = 0;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] === '#') { run++; continue; }
      if (run) group.appendChild(svg('rect', { x: x - run, y, width: run, height: 1, 'shape-rendering': 'crispEdges' }));
      run = 0;
    }
  });
  holder.appendChild(group);
  chip.appendChild(holder);
  return chip;
}

function iconChip(src) {
  const chip = document.createElement('div');
  chip.className = 'chip chip--icon';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  chip.appendChild(img);
  return chip;
}

function makeChip([kind, value]) {
  if (kind === 'lada') return ladaChip();
  return iconChip(value);
}

function fillRail(rail, items) {
  /* Two identical passes so a -50% shift loops seamlessly. */
  for (let pass = 0; pass < 2; pass++) {
    items.forEach((item) => rail.appendChild(makeChip(item)));
  }
}

function cardDefi() {
  const rows = [
    { id: 'railA', items: scatterRow(0), secs: 34, back: false },
    { id: 'railB', items: scatterRow(2), secs: 40, back: true },
    { id: 'railC', items: scatterRow(4), secs: 30, back: false },
  ];

  rows.forEach(({ id, items, secs, back }) => {
    const rail = document.getElementById(id);
    fillRail(rail, items);
    if (reduced) return;

    if (back) gsap.fromTo(rail, { xPercent: -50 }, { xPercent: 0, duration: secs, ease: 'none', repeat: -1 });
    else gsap.to(rail, { xPercent: -50, duration: secs, ease: 'none', repeat: -1 });
  });
}

/* ------------------------------------------------------------------ *
 * /multiplier: one deposit, counted on more surfaces
 * ------------------------------------------------------------------ */
const RAILS = [
  { d: 'M -14,64 L 274,14',  label: '+LP',   per: 5.4 },
  { d: 'M -14,146 L 274,96', label: '+Lend', per: 6.2 },
  { d: 'M -14,228 L 274,178', label: 'Stake', per: 7.0 },
];

function cardMultiplier() {
  const railHost = document.getElementById('multRails');
  const coinHost = document.getElementById('multCoins');

  RAILS.forEach((rail, i) => {
    railHost.appendChild(svg('path', {
      d: rail.d,
      fill: 'none',
      stroke: 'rgba(255,206,170,0.30)',
      'stroke-width': 1.25,
      'stroke-dasharray': '4 8',
    }));

    const label = svg('text', {
      x: 208, y: 14 + i * 82 - 12,
      fill: 'rgba(255,255,255,0.42)',
      'font-size': 11,
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
    });
    label.textContent = rail.label;
    railHost.appendChild(label);

    /* Two coins per rail, evenly spaced along the loop. */
    for (let n = 0; n < 2; n++) {
      const coin = svg('g');
      coin.appendChild(svg('circle', { r: 13.5, fill: '#1a0c0e' }));
      coin.appendChild(svg('circle', { r: 12.9, fill: 'none', stroke: '#ff7a52', 'stroke-width': 1.1 }));
      coin.appendChild(ladaMark('#ff8a63', 1.4));
      coinHost.appendChild(coin);

      const tween = gsap.to(coin, {
        duration: rail.per,
        ease: 'none',
        repeat: -1,
        motionPath: { path: rail.d, autoRotate: false },
      });
      tween.progress(n / 2);
      if (reduced) tween.pause();
    }
  });
}

export function initFeatures() {
  if (!document.getElementById('stakeRings')) return;

  buildLadaMark();
  cardStake();
  cardYield();
  cardDefi();
  cardMultiplier();
}
