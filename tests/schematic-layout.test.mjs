import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeView, routeOrthogonal, visibleIds } from '../assets/schematic-layout.js';

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
  assert.equal(routeOrthogonal({ x: 10, y: 10 }, { x: 80, y: 90 }, 40), 'M10,10 H40 V90 H80');
});
