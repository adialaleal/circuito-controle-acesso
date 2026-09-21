import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ANCHORS, anchorPosition, layoutStorageKey, normalizeView, routeOrthogonal, visibleIds } from '../assets/schematic-layout.js';

test('old hashes default to guided step 1', () => {
  assert.deepEqual(normalizeView({}), { view: 'guided', step: 1 });
  assert.deepEqual(normalizeView({ view: 'full', step: '9' }), { view: 'full', step: 4 });
});

test('XL4016 step 2 includes its visible distribution path only with LTE', () => {
  const lte = visibleIds(2, { tft: false, net: 'lte', power: 'xl4016' });
  assert.ok(lte.includes('xl4016') && lte.includes('borne5xl') && lte.includes('modem'));
  assert.ok(!visibleIds(2, { tft: false, net: 'wifi', power: 'xl4016' }).includes('modem'));
});

test('orthogonal router emits non-zero segments', () => {
  assert.equal(routeOrthogonal({ x: 10, y: 10 }, { x: 80, y: 10 }, 40), 'M10,10 H80');
  assert.equal(routeOrthogonal({ x: 10, y: 10 }, { x: 10, y: 90 }, 40), 'M10,10 V90');
  assert.equal(routeOrthogonal({ x: 10, y: 10 }, { x: 80, y: 90 }, 40), 'M10,10 H40 V90 H80');
});

test('stage 4 contains each supported variant exactly where its wiring applies', () => {
  const variants = [
    { variant: { tft: false, net: 'wifi', power: 'lm2596' }, absent: ['display', 'wire-20', 'wire-27', 'modem', 'wire-28', 'xl4016', 'wire-34'], present: ['lm2596', 'wire-46', 'wire-48'] },
    { variant: { tft: true, net: 'dual', power: 'lm2596' }, absent: ['xl4016', 'wire-34'], present: ['display', 'wire-20', 'wire-21', 'wire-22', 'wire-23', 'wire-24', 'wire-25', 'wire-26', 'wire-27', 'modem', 'wire-28', 'wire-45', 'wire-46', 'wire-47', 'wire-48'] },
    { variant: { tft: false, net: 'lte', power: 'xl4016' }, absent: ['display', 'wire-20', 'lm2596', 'wire-28'], present: ['xl4016', 'borne5xl', 'wire-34', 'wire-41', 'modem', 'wire-42', 'wire-46', 'wire-48'] },
  ];
  for (const { variant, absent, present } of variants) {
    const ids = visibleIds(4, variant);
    present.forEach((id) => assert.ok(ids.includes(id), `${JSON.stringify(variant)} includes ${id}`));
    absent.forEach((id) => assert.ok(!ids.includes(id), `${JSON.stringify(variant)} excludes ${id}`));
  }
});

test('invalid or partial variants normalize to the safe baseline', () => {
  const baseline = visibleIds(4, { tft: false, net: 'wifi', power: 'lm2596' });
  assert.deepEqual(visibleIds(4, {}), baseline);
  assert.deepEqual(visibleIds(4, null), baseline);
  assert.deepEqual(visibleIds(4, { net: 'invalid', power: 'invalid' }), baseline);
  assert.equal(layoutStorageKey({ tft: true, net: 'lte', power: 'xl4016' }), 'schematic-layout:tft:lte:xl4016');
  assert.equal(layoutStorageKey({}), 'schematic-layout:plain:wifi:lm2596');
  assert.equal(layoutStorageKey(null), 'schematic-layout:plain:wifi:lm2596');
});

test('every wire endpoint resolves to a real component-pin anchor', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const registeredAnchors = new Set([...html.matchAll(/data-anchor="([^"]+)"/g)].map(([, name]) => name));
  const registry = Object.fromEntries([...html.matchAll(/data-anchor="([^"]+)" cx="([^"]+)" cy="([^"]+)"/g)].map(([, name, x, y]) => [name, { x: Number(x), y: Number(y) }]));
  const wires = [...html.matchAll(/<path class="wire"[^>]*>/g)].map(([tag]) => tag);
  assert.equal(wires.length, 48);
  for (const wire of wires) {
    const from = wire.match(/data-from="([^"]+)"/)?.[1];
    const to = wire.match(/data-to="([^"]+)"/)?.[1];
    assert.ok(from && to, wire);
    assert.match(from, /^[a-z0-9]+\.[a-z0-9-]+$/);
    assert.match(to, /^[a-z0-9]+\.[a-z0-9-]+$/);
    assert.ok(registeredAnchors.has(from), `${from} is registered in the SVG`);
    assert.ok(registeredAnchors.has(to), `${to} is registered in the SVG`);
    assert.deepEqual(anchorPosition(from), ANCHORS[from]);
    assert.deepEqual(anchorPosition(to), ANCHORS[to]);
    const d = wire.match(/\sd="([^"]+)"/)?.[1];
    const tokens = d.match(/[MHV]|-?\d+(?:\.\d+)?/g);
    let index = 0;
    let x;
    let y;
    let start;
    while (index < tokens.length) {
      const command = tokens[index++];
      if (command === 'M') {
        x = Number(tokens[index++]);
        y = Number(tokens[index++]);
        start = { x, y };
      } else if (command === 'H') {
        x = Number(tokens[index++]);
      } else if (command === 'V') {
        y = Number(tokens[index++]);
      }
    }
    assert.deepEqual(anchorPosition(from), start, `${from} matches the SVG route start`);
    assert.deepEqual(anchorPosition(to), { x, y }, `${to} matches the SVG route end`);
  }
  assert.deepEqual(anchorPosition('p4.out-plus'), { x: 410, y: 110 });
  assert.deepEqual(anchorPosition('xl4016.out-plus'), { x: 190, y: 455 });
  assert.deepEqual(anchorPosition('display.vcc'), { x: 513, y: 1012 });
  assert.deepEqual(anchorPosition('rele.in1'), { x: 888, y: 420 });
  assert.deepEqual(anchorPosition('ima1.plus'), { x: 1340, y: 320 });
  assert.deepEqual(registry, ANCHORS);
});
