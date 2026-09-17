/* ADA climbs the volcano, strikes the Lava coin, and mints as L-ADA. */

import { buildLadaMark, ladaMark } from './lada-mark.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CONFIG = {
  vent:     { x: 720, y: 85 },
  heroCoin: { x: 720, y: 108 },

  inflow:   { every: [0.45, 0.95], travel: [3.6, 5.2] },
  eruption: { every: [0.35, 0.70], travel: [2.2, 3.6] },
  embers:   { every: [0.10, 0.26], travel: [1.1, 2.0] },
};

const CHIP_R = 15;

const TOKENS = {
  ada:  { fill: '#3b7cf3', ring: '#ffffff',                 ink: '#ffffff' },
  lada: { fill: '#1a0c0e', ring: '#ff9a5a',                 ink: '#ffb089' },
};

const rand = gsap.utils.random;

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
}

function adaGlyph(color) {
  const group = el('g', { fill: color });
  const ring = (count, radius, dot, offset = 0) => {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      group.appendChild(el('circle', {
        cx: (Math.cos(a) * radius).toFixed(2),
        cy: (Math.sin(a) * radius).toFixed(2),
        r: dot,
      }));
    }
  };
  ring(6,  3.6, 1.35, -Math.PI / 2);
  ring(6,  6.6, 0.95, -Math.PI / 2 + Math.PI / 6);
  ring(6,  9.2, 0.68, -Math.PI / 2);
  ring(12, 11.4, 0.48, -Math.PI / 2);
  return group;
}

function makeChip(kind, radius = CHIP_R) {
  const token = TOKENS[kind];
  const unit = radius / 15;
  const chip = el('g');
  chip.setAttribute('filter', 'url(#chipShadow)');
  if (kind === 'lada') chip.appendChild(el('circle', { r: radius * 2.2, fill: 'url(#ejectaGlow)' }));
  chip.appendChild(el('circle', { r: radius + 1, fill: '#05070a' }));
  chip.appendChild(el('circle', { r: radius, fill: token.fill }));
  chip.appendChild(el('circle', {
    r: radius - 0.8,
    fill: 'none',
    stroke: token.ring,
    'stroke-width': kind === 'ada' ? 1.6 : 1.4,
  }));

  const face = el('g');
  face.setAttribute('clip-path', 'url(#chipGlyphClip)');
  if (kind === 'ada') {
    const glyph = adaGlyph(token.ink);
    glyph.setAttribute('transform', `scale(${unit * 0.82})`);
    face.appendChild(glyph);
  } else {
    /* Sized to the inner disc so the fireball doesn't spill over the rim. */
    face.appendChild(ladaMark(token.ink, unit * 1.18));
  }
  chip.appendChild(face);

  return chip;
}

function buildHeroCoin() {
  const { x, y } = CONFIG.heroCoin;
  const host = document.getElementById('heroCoin');
  host.setAttribute('transform', `translate(${x} ${y})`);

  const halo = el('ellipse', { rx: 130, ry: 62, fill: 'url(#coinHalo)', filter: 'url(#softGlow)' });
  halo.id = 'heroHalo';

  const body = el('g');
  body.id = 'coinBody';
  body.appendChild(el('ellipse', { cy: 5, rx: 46, ry: 15, fill: 'url(#coinEdge)' }));
  body.appendChild(el('rect', { x: -46, y: -5, width: 92, height: 10, fill: 'url(#coinEdge)' }));
  body.appendChild(el('ellipse', { cy: -5, rx: 46, ry: 15, fill: 'url(#coinFace)' }));
  body.appendChild(el('ellipse', { cy: -5, rx: 44.5, ry: 13.8, fill: 'none', stroke: 'rgba(255,150,90,0.45)', 'stroke-width': 1.2 }));

  const face = el('g');
  face.setAttribute('clip-path', 'url(#heroGlyphClip)');
  const mark = ladaMark('#ff8a63', 2.15, 0.72);
  mark.setAttribute('transform', `translate(${-7.5 * 2.15} ${-7.5 * 0.72 - 5}) scale(2.15 0.72)`);
  face.appendChild(mark);
  body.appendChild(face);

  host.append(halo, body);
}

const live = new Set();

function track(tween) {
  live.add(tween);
  return tween;
}

let climbCount = 0;

/* ADA rides a slope from the base up into the crater, then mints as L-ADA. */
function climb() {
  const side = climbCount++ % 2 ? '#slopeL' : '#slopeR';
  const chip = makeChip('ada');
  chip.setAttribute('opacity', '1');
  document.getElementById('layerInflow').appendChild(chip);

  const duration = rand(...CONFIG.inflow.travel);
  const tl = gsap.timeline({
    onComplete() { live.delete(tl); },
  });
  track(tl);

  tl.fromTo(chip,
    { scale: 1 },
    {
      duration,
      ease: 'power1.in',
      scale: 1,
      motionPath: { path: side, autoRotate: false },
    })
    .add(() => mintFrom(chip), '-=0.02');

  return tl;
}

function mintFrom(adaChip) {
  strikeFlash();
  gsap.to(adaChip, {
    duration: 0.12,
    opacity: 0,
    scale: 0.55,
    ease: 'power2.in',
    onComplete: () => adaChip.remove(),
  });
  erupt();
}

function strikeFlash() {
  const flash = el('circle', {
    cx: CONFIG.heroCoin.x, cy: CONFIG.heroCoin.y, r: 12, fill: '#fff6e4', opacity: 0.95,
  });
  document.getElementById('ventCore').appendChild(flash);

  gsap.to(flash, {
    duration: 0.55,
    ease: 'power2.out',
    attr: { r: 78 },
    opacity: 0,
    onComplete: () => flash.remove(),
  });

  gsap.fromTo('#coinBody', { scale: 1 }, {
    scale: 1.12, duration: 0.12, yoyo: true, repeat: 1,
    transformOrigin: '50% 50%', ease: 'power2.out',
  });
}

function eruptionPath() {
  const { x, y } = CONFIG.heroCoin;
  const dir = Math.random() < 0.5 ? -1 : 1;

  return [
    `M ${x},${y}`,
    `C ${x + dir * rand(50, 140)},${y - rand(20, 80)}`,
    `${x + dir * rand(200, 400)},${y + rand(-30, 70)}`,
    `${x + dir * rand(460, 720)},${y + rand(40, 200)}`,
  ].join(' ');
}

function erupt() {
  const coin = makeChip('lada');
  coin.setAttribute('opacity', '0');
  document.getElementById('layerErupt').appendChild(coin);

  const duration = rand(...CONFIG.eruption.travel);
  const tl = gsap.timeline({
    onComplete() { live.delete(tl); coin.remove(); },
  });
  track(tl);

  tl.fromTo(coin,
    { scale: 0.85, rotation: rand(-30, 30) },
    {
      duration,
      ease: 'power2.out',
      scale: 1,
      rotation: `+=${rand(-120, 120)}`,
      motionPath: { path: eruptionPath(), autoRotate: false },
    })
    .to(coin, { duration: 0.1, opacity: 1, ease: 'power2.out' }, 0)
    .to(coin, { duration: duration * 0.25, opacity: 0, ease: 'power2.in' }, duration * 0.75);

  return tl;
}

function ember() {
  const { x, y } = CONFIG.vent;
  const angle = rand(-42, 42);
  const distance = rand(280, 620);
  const rad = (angle - 90) * (Math.PI / 180);
  const duration = rand(...CONFIG.embers.travel);

  const spark = el('line', {
    x1: 0, y1: 0, x2: 0, y2: rand(30, 70),
    stroke: 'url(#emberGrad)',
    'stroke-width': rand(1.2, 2.6).toFixed(2),
    'stroke-linecap': 'round',
  });
  document.getElementById('layerEmbers').appendChild(spark);

  gsap.set(spark, { x, y, rotation: angle, transformOrigin: '50% 0%', opacity: 0 });

  const tl = gsap.timeline({
    onComplete() { live.delete(tl); spark.remove(); },
  });
  track(tl);

  tl.to(spark, {
      duration,
      ease: 'power1.out',
      x: x + Math.cos(rad) * distance,
      y: y + Math.sin(rad) * distance,
    })
    .to(spark, { duration: duration * 0.2, opacity: rand(0.5, 1), ease: 'none' }, 0)
    .to(spark, { duration: duration * 0.5, opacity: 0, ease: 'power2.in' }, duration * 0.5);

  return tl;
}

function ventPulse() {
  gsap.to('#ventCore', {
    duration: 2.4,
    scale: 1.09,
    opacity: 0.82,
    svgOrigin: `${CONFIG.vent.x} ${CONFIG.vent.y}`,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  gsap.to('#heroHalo', {
    duration: 1.9, scale: 1.12, opacity: 0.85,
    ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 50%',
  });

  gsap.to('#coinBody', {
    duration: 3.2, y: -8, ease: 'sine.inOut', yoyo: true, repeat: -1,
  });
}

function shockRing() {
  const { x, y } = CONFIG.heroCoin;
  const ring = el('ellipse', {
    cx: x, cy: y, rx: 34, ry: 12,
    fill: 'none', stroke: '#ffcf99', 'stroke-width': 2.5, opacity: 0.7,
  });
  document.getElementById('layerErupt').appendChild(ring);

  const tween = gsap.to(ring, {
    duration: 1.7,
    ease: 'power2.out',
    attr: { rx: 300, ry: 92 },
    opacity: 0,
    onComplete() { live.delete(tween); ring.remove(); },
  });
  return track(tween);
}

let running = true;

function loop(fn, [min, max]) {
  const tick = () => {
    if (running) fn();
    gsap.delayedCall(rand(min, max), tick);
  };
  gsap.delayedCall(rand(min, max), tick);
}

function seed() {
  for (let i = 0; i < 5; i++) climb().progress(rand(0.12, 0.88));
  for (let i = 0; i < 4; i++) erupt().progress(rand(0.15, 0.8));
}

export function initEruption() {
  const scene = document.getElementById('scene');
  if (!scene) return;

  buildLadaMark();
  buildHeroCoin();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < 3; i++) climb().progress(rand(0.2, 0.7)).pause();
    for (let i = 0; i < 4; i++) erupt().progress(rand(0.2, 0.7)).pause();
    return;
  }

  ventPulse();
  seed();

  loop(climb, CONFIG.inflow.every);
  loop(ember, CONFIG.embers.every);
  loop(shockRing, [2.6, 4.4]);

  new IntersectionObserver((entries) => {
    running = entries[0].isIntersecting;
    live.forEach((tween) => (running ? tween.resume() : tween.pause()));
  }, { threshold: 0 }).observe(scene);
}
