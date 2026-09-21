import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as layout from '../assets/schematic-layout.js';
import { ANCHORS, anchorPosition, layoutStorageKey, normalizeView, routeOrthogonal, sanitizePositions, visibleIds } from '../assets/schematic-layout.js';

function extractRenderLayout(html) {
  const start = html.indexOf('function layoutPositionChanged(id, layout){');
  const end = html.indexOf('function applyLayout(positions){', start);
  assert.ok(start >= 0 && end > start, 'renderLayout source is available');
  return new Function('svg', 'layoutModel', `${html.slice(start, end)}\nreturn renderLayout;`);
}

function fakeWire(tag) {
  const attributes = new Map([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
  return {
    dataset: Object.fromEntries([...attributes]
      .filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value])),
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
  };
}

function renderWireRoutes(ids, positions) {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const wires = ids.map((id) => {
    const tag = html.match(new RegExp(`<path class="wire"[^>]*data-wire-id="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `${id} exists`);
    return [id, fakeWire(tag)];
  });
  const svg = {
    querySelectorAll(selector) {
      if (selector === '.comp[data-layout-id]' || selector === '.wire-hit[data-wire-id]') return [];
      if (selector === '.wire[data-reroutable]') return wires.map(([, wire]) => wire);
      return [];
    },
  };
  extractRenderLayout(html)(svg, layout)(positions);
  return Object.fromEntries(wires.map(([id, wire]) => [id, wire.getAttribute('d')]));
}

function renderJunction(anchor, positions) {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = html.match(new RegExp(`<circle class="dot"[^>]*data-junction-anchor="${anchor}"[^>]*>`))?.[0];
  assert.ok(tag, `${anchor} has a rendered junction dot`);
  const dot = fakeWire(tag);
  const svg = {
    querySelectorAll(selector) {
      if (selector === '[data-junction-anchor]') return [dot];
      return [];
    },
  };
  extractRenderLayout(html)(svg, layout)(positions);
  return { x: Number(dot.getAttribute('cx')), y: Number(dot.getAttribute('cy')) };
}

function pathContainsPoint(path, point) {
  let current = null;
  for (const [, command, first, second] of path.matchAll(/([MHV])(-?\d+)(?:,(-?\d+))?/g)) {
    const next = command === 'M' ? { x: Number(first), y: Number(second) }
      : command === 'H' ? { x: Number(first), y: current.y }
        : { x: current.x, y: Number(first) };
    if (current && ((current.x === next.x && point.x === current.x && point.y >= Math.min(current.y, next.y) && point.y <= Math.max(current.y, next.y))
      || (current.y === next.y && point.y === current.y && point.x >= Math.min(current.x, next.x) && point.x <= Math.max(current.x, next.x)))) return true;
    current = next;
  }
  return current?.x === point.x && current?.y === point.y;
}

test('renderLayout keeps LM and LTE ground paths joined at their shared Wago junction', () => {
  const moved = { ...layout.DEFAULT_LAYOUT, lm2596: { ...layout.DEFAULT_LAYOUT.lm2596, x: 90, y: 300 } };
  const routes = renderWireRoutes(['wire-08', 'wire-29'], moved);
  const junction = layout.anchorPositionForLayout('bornegnd.lte-ground', moved);
  assert.equal(pathContainsPoint(routes['wire-08'], junction), true);
  assert.equal(pathContainsPoint(routes['wire-29'], junction), true);
});

test('renderLayout keeps TFT ground trunk joined while ESP32 moves vertically', () => {
  const moved = { ...layout.DEFAULT_LAYOUT, esp32: { ...layout.DEFAULT_LAYOUT.esp32, x: 560, y: 340 } };
  const routes = renderWireRoutes(['wire-09', 'wire-21'], moved);
  const junction = layout.anchorPositionForLayout('esp32.display-ground', moved);
  assert.equal(pathContainsPoint(routes['wire-09'], junction), true);
  assert.equal(pathContainsPoint(routes['wire-21'], junction), true);
});

test('renderLayout moves the visible TFT ground junction with its GND trunk owner', () => {
  const moved = { ...layout.DEFAULT_LAYOUT, bornegnd: { ...layout.DEFAULT_LAYOUT.bornegnd, x: 490, y: 120 } };
  assert.deepEqual(renderJunction('esp32.display-ground', moved), layout.anchorPositionForLayout('esp32.display-ground', moved));
});

test('renderLayout routes relay locks through diodes and Wago ground through every lock tap', () => {
  const relayMoved = { ...layout.DEFAULT_LAYOUT, rele: { ...layout.DEFAULT_LAYOUT.rele, x: 1020, y: 330 } };
  const relayRoutes = renderWireRoutes(['wire-09', 'wire-46', 'wire-47', 'wire-48'], relayMoved);
  for (const [wire, terminal] of [['wire-46', 'd1.lock-input'], ['wire-47', 'd2.lock-input'], ['wire-48', 'd3.lock-input']]) {
    assert.equal(pathContainsPoint(relayRoutes[wire], layout.anchorPositionForLayout(terminal, relayMoved)), true, `${wire} joins its diode`);
  }
  assert.equal(pathContainsPoint(relayRoutes['wire-09'], layout.anchorPositionForLayout('d1.ground-out', relayMoved)), true);

  const groundMoved = { ...layout.DEFAULT_LAYOUT, bornegnd: { ...layout.DEFAULT_LAYOUT.bornegnd, x: 490, y: 120 } };
  const groundRoutes = renderWireRoutes(['wire-09', 'wire-10', 'wire-11', 'wire-21'], groundMoved);
  for (const junction of ['ima2.ground-rail', 'ima3.ground-rail', 'esp32.display-ground']) {
    const point = layout.anchorPositionForLayout(junction, groundMoved);
    assert.equal(pathContainsPoint(groundRoutes['wire-09'], point), true, `ground trunk reaches ${junction}`);
    if (junction !== 'esp32.display-ground') {
      const branch = junction.startsWith('ima2') ? 'wire-10' : 'wire-11';
      assert.equal(pathContainsPoint(groundRoutes[branch], point), true, `${branch} joins ${junction}`);
    }
  }
  assert.equal(pathContainsPoint(groundRoutes['wire-21'], layout.anchorPositionForLayout('esp32.display-ground', groundMoved)), true);
});

test('old hashes default to guided step 1', () => {
  assert.deepEqual(normalizeView({}), { view: 'guided', step: 1 });
  assert.deepEqual(normalizeView({ view: 'full', step: '9' }), { view: 'full', step: 4 });
});

test('XL4016 step 2 includes its visible distribution path only with LTE', () => {
  const lte = visibleIds(2, { tft: false, net: 'lte', power: 'xl4016' });
  assert.ok(lte.includes('xl4016') && lte.includes('borne5xl') && lte.includes('modem'));
  assert.ok(!visibleIds(2, { tft: false, net: 'wifi', power: 'xl4016' }).includes('modem'));
});

test('XL4016 outputs connect directly to the two Wagos and the canvas is full width', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-wire-id="wire-34"[\s\S]*d="M100,430 V440"/);
  assert.match(html, /data-wire-id="wire-37"[\s\S]*d="M160,430 V480"/);
  assert.match(html, /<circle class="terminal-dot" data-terminal-anchor="borne5xl\.plus"[^>]*cx="100" cy="440"/);
  assert.match(html, /<circle class="terminal-dot" data-terminal-anchor="borne5xl\.ground"[^>]*cx="160" cy="480"/);
  assert.match(html, /\.schematic-layout\{display:block/);
  assert.match(html, /\.schematic-layout\{display:block;width:100%;min-width:0/);
  assert.match(html, /\.schematic-inspector-strip\{display:grid/);
  assert.match(html, /\.canvas-wrap\{[\s\S]*?width:100%;[\s\S]*?min-width:0/);
  assert.match(html, /<aside class="schematic-inspector-strip">[\s\S]*?<\/aside>\s*<div id="schematic-canvas" class="canvas-wrap">/);
  assert.match(html, /@media\(max-width:700px\)\{[\s\S]*?\.schematic-inspector-strip\{grid-template-columns:1fr/);
});

test('XL4016 keeps 12V, ground and relay 5V connectivity through its Wago', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = new Set(visibleIds(3, { tft: false, net: 'lte', power: 'xl4016' }));
  ['wire-49', 'wire-50', 'wire-51'].forEach((id) => assert.ok(ids.has(id), `${id} remains visible in XL mode`));
  const expected = {
    'wire-49': ['borne12.out-plus', 'xl4016.input-plus'],
    'wire-50': ['bornegnd.out-ground', 'xl4016.input-ground'],
    'wire-51': ['borne5xl.plus-rail', 'rele.vcc-rail'],
  };
  for (const [id, [from, to]] of Object.entries(expected)) {
    const tag = html.match(new RegExp(`<path class="wire"[^>]*data-wire-id="${id}"[^>]*>`))?.[0];
    assert.match(tag, new RegExp(`data-from="${from}"`));
    assert.match(tag, new RegExp(`data-to="${to}"`));
  }
});

test('guided stages are cumulative and hide output locks before step 4', () => {
  const step3 = visibleIds(3, { tft: false, net: 'lte', power: 'xl4016' });
  assert.ok(step3.includes('esp32') && step3.includes('modem') && step3.includes('rele'));
  assert.ok(!step3.includes('lock1') && !step3.includes('lock2') && !step3.includes('lock3'));
  assert.ok(visibleIds(4, { tft: false, net: 'lte', power: 'xl4016' }).includes('lock3'));
});

test('guided variants never expose a wire before both endpoint components', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const wires = [...html.matchAll(/<path class="wire"[^>]*>/g)].map(([tag]) => ({
    id: tag.match(/data-wire-id="([^"]+)"/)?.[1],
    from: tag.match(/data-from="([^"]+)"/)?.[1].split('.')[0],
    to: tag.match(/data-to="([^"]+)"/)?.[1].split('.')[0],
  }));
  const variants = [
    { tft: false, net: 'wifi', power: 'lm2596' }, { tft: true, net: 'wifi', power: 'lm2596' },
    { tft: false, net: 'dual', power: 'lm2596' }, { tft: true, net: 'dual', power: 'lm2596' },
    { tft: false, net: 'dual', power: 'xl4016' }, { tft: true, net: 'dual', power: 'xl4016' },
    { tft: false, net: 'lte', power: 'lm2596' }, { tft: true, net: 'lte', power: 'lm2596' },
    { tft: false, net: 'lte', power: 'xl4016' }, { tft: true, net: 'lte', power: 'xl4016' },
  ];
  for (const variant of variants) {
    for (let step = 1; step <= 4; step += 1) {
      const visible = new Set(visibleIds(step, variant));
      for (const wire of wires.filter(({ id }) => visible.has(id))) {
        assert.ok(visible.has(wire.from), `${JSON.stringify(variant)} step ${step}: ${wire.id} needs ${wire.from}`);
        assert.ok(visible.has(wire.to), `${JSON.stringify(variant)} step ${step}: ${wire.id} needs ${wire.to}`);
      }
    }
  }
});

test('rerouted endpoints follow the current component layout', () => {
  assert.equal(typeof layout.anchorPositionForLayout, 'function');
  const moved = { ...layout.DEFAULT_LAYOUT, p4: { ...layout.DEFAULT_LAYOUT.p4, x: 364, y: 118 } };
  assert.deepEqual(layout.anchorPositionForLayout('p4.input', moved), { x: 346, y: 155 });
  assert.equal(
    routeOrthogonal(layout.anchorPositionForLayout('fonte.p4-plus', moved), layout.anchorPositionForLayout('p4.input', moved), 280),
    'M220,125 H280 V155 H346',
  );
});

test('moving ESP32 reroutes wire-17 from its moved GPIO22 endpoint', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const wire17 = html.match(/<path class="wire"[^>]*data-wire-id="wire-17"[^>]*>/)?.[0];
  const moved = { ...layout.DEFAULT_LAYOUT, esp32: { ...layout.DEFAULT_LAYOUT.esp32, x: 600, y: 300 } };
  const from = layout.anchorPositionForLayout('esp32.gpio22', moved);
  const to = layout.anchorPositionForLayout('rele.in1', moved);
  assert.ok(wire17?.includes('data-reroutable'));
  assert.deepEqual(from, { x: 812, y: 380 });
  assert.equal(routeOrthogonal(from, to, Math.round((from.x + to.x) / 2)), 'M812,380 H850 V420 H888');
});

test('moving ESP32 moves the shared 5V rail and its relay branch', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const moved = { ...layout.DEFAULT_LAYOUT, esp32: { ...layout.DEFAULT_LAYOUT.esp32, x: 600, y: 300 } };
  const rail = layout.anchorPositionForLayout('lm2596.5v-rail', moved);
  const supply = layout.routeOrthogonalVia(
    layout.anchorPositionForLayout('lm2596.out-plus', moved),
    rail,
    layout.anchorPositionForLayout('esp32.vin', moved),
  );
  const relayBranch = routeOrthogonal(rail, layout.anchorPositionForLayout('rele.vcc-rail', moved), 774);
  assert.deepEqual(rail, { x: 560, y: 860 });
  assert.match(html.match(/<path class="wire"[^>]*data-wire-id="wire-14"[^>]*>/)?.[0], /data-via="lm2596\.5v-rail"/);
  assert.match(html, /layoutModel\.anchorLayoutOwner\(wire\.dataset\.from\)/);
  assert.match(html, /layoutModel\.routeOrthogonalThrough\(\[from,...viaNames\.map\(name=>layoutModel\.anchorPositionForLayout\(name,layout\)\),to\]\)/);
  assert.match(supply, /H560 M560,860/);
  assert.match(relayBranch, /^M560,860 /);
  assert.notEqual(relayBranch, 'M520,860 H988 V782');
});

test('moving the XL Wago moves every branch sourced at its terminals', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const moved = { ...layout.DEFAULT_LAYOUT, borne5xl: { ...layout.DEFAULT_LAYOUT.borne5xl, x: 150, y: 440 } };
  const branches = {
    'wire-34': ['xl4016.output-plus', 'borne5xl.plus'],
    'wire-35': ['borne5xl.plus-rail', 'esp32.vin'],
    'wire-36': ['borne5xl.plus-rail', 'modem.vin'],
    'wire-38': ['borne5xl.ground-rail', 'esp32.ground'],
    'wire-39': ['borne5xl.ground-rail', 'modem.ground'],
  };
  for (const [wireId, [from, to]] of Object.entries(branches)) {
    const tag = html.match(new RegExp(`<path class="wire"[^>]*data-wire-id="${wireId}"[^>]*>`))?.[0];
    assert.match(tag, new RegExp(`data-from="${from}"`));
    assert.match(tag, new RegExp(`data-to="${to}"`));
    const movedEndpoint = from.startsWith('borne5xl.') ? layout.anchorPositionForLayout(from, moved) : layout.anchorPositionForLayout(to, moved);
    const baselineEndpoint = from.startsWith('borne5xl.') ? layout.anchorPositionForLayout(from) : layout.anchorPositionForLayout(to);
    assert.notDeepEqual(movedEndpoint, baselineEndpoint, `${wireId} must not retain its original Wago terminal`);
  }
});

test('shared relay and modem taps follow their moved assemblies', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const relay = { ...layout.DEFAULT_LAYOUT, rele: { ...layout.DEFAULT_LAYOUT.rele, x: 940, y: 330 } };
  const lockTap = layout.anchorPositionForLayout('borne12.lock1-rail', relay);
  const lockTap2 = layout.anchorPositionForLayout('borne12.lock2-rail', relay);
  const com1 = layout.anchorPositionForLayout('rele.nc1', relay);
  assert.deepEqual(lockTap, { x: 1250, y: 390 });
  assert.deepEqual(lockTap2, { x: 1250, y: 490 });
  assert.deepEqual(com1, { x: 1232, y: 420 });
  assert.match(html.match(/<path class="wire"[^>]*data-wire-id="wire-04"[^>]*>/)?.[0], /data-via="borne12\.lock1-rail borne12\.lock2-rail"/);
  assert.match(layout.routeOrthogonalThrough([
    layout.anchorPositionForLayout('borne12.lock-plus', relay), lockTap, lockTap2,
    layout.anchorPositionForLayout('rele.power-rail', relay),
  ]), /H1250 M1250,390/);
  assert.match(routeOrthogonal(lockTap, layout.anchorPositionForLayout('rele.lock1-input', relay), 1241), /^M1250,390 /);
  assert.match(routeOrthogonal(com1, layout.anchorPositionForLayout('ima1.plus', relay), 1286), /^M1232,420 /);

  const lm = { ...layout.DEFAULT_LAYOUT, lm2596: { ...layout.DEFAULT_LAYOUT.lm2596, x: 90, y: 300 } };
  const modemTap = layout.anchorPositionForLayout('borne12.lte-plus', lm);
  assert.deepEqual(modemTap, { x: 380, y: 210 });
  assert.match(html.match(/<path class="wire"[^>]*data-wire-id="wire-03"[^>]*>/)?.[0], /data-via="borne12\.lte-plus"/);
  assert.match(layout.routeOrthogonalThrough([
    layout.anchorPositionForLayout('borne12.out-plus', lm),
    modemTap,
    layout.anchorPositionForLayout('lm2596.in-plus', lm),
  ]), /H380 M380,210/);
  assert.match(routeOrthogonal(modemTap, layout.anchorPositionForLayout('lm2596b.in-plus', lm), 360), /^M380,210 /);
});

test('every draggable component has only reroutable attached wires', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const draggable = new Set([...html.matchAll(/<g class="comp"[^>]*data-layout-id="([^"]+)"[^>]*data-layout-editable/g)].map(([, id]) => id));
  const wires = [...html.matchAll(/<path class="wire"[^>]*>/g)].map(([tag]) => ({
    tag,
    from: tag.match(/data-from="([^"]+)"/)?.[1]?.split('.')[0],
    to: tag.match(/data-to="([^"]+)"/)?.[1]?.split('.')[0],
  }));
  assert.ok(draggable.size > 0);
  for (const id of draggable) {
    assert.ok(wires.some(({ from, to }) => from === id || to === id), `${id} has no anchored connection`);
    for (const wire of wires.filter(({ from, to }) => from === id || to === id)) {
      assert.ok(wire.tag.includes('data-reroutable'), `${id} has untracked ${wire.tag.match(/data-wire-id="([^"]+)"/)?.[1]}`);
    }
  }
});

test('unmodeled antenna and diode-lock assemblies are not draggable', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ['modem', 'ima1', 'ima2', 'ima3'].forEach((id) => {
    const tag = html.match(new RegExp(`<g class="comp"[^>]*data-id="${id}"[^>]*>`))?.[0];
    assert.doesNotMatch(tag, /data-layout-editable/);
  });
});

test('schematic offers accessible guided and full-view controls', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="mode-guided"[^>]*aria-pressed/);
  assert.match(html, /id="mode-full"[^>]*aria-pressed/);
  assert.match(html, /id="guided-stepper"/);
  assert.match(html, /function applySchematicView\(\)/);
  assert.match(html, /function setSchematicView\(view, step\)/);
  assert.match(html, /history\.replaceState\(null,'',hash\)/);
});

test('full view provides an isolated local layout editor controlled by drag handles', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="layout-edit"/);
  assert.match(html, /id="layout-restore"/);
  assert.match(html, /function enterLayoutEditor\(\)/);
  assert.match(html, /function exitLayoutEditor\(\)/);
  assert.match(html, /function restoreLayout\(\)/);
  assert.match(html, /function applyLayout\(positions\)/);
  assert.match(html, /\[data-drag-handle\]/);
  assert.match(html, /layoutModel\.layoutStorageKey\(cfg\)/);
  assert.match(html, /localStorage\.removeItem\(layoutModel\.layoutStorageKey\(cfg\)\)/);
});

test('drag handles own touch gestures and hash transitions leave editor mode', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.drag-handle\{[^}]*touch-action:none/);
  assert.doesNotMatch(html, /(?:#schematic|\.canvas-wrap svg)\{[^}]*touch-action:none/);
  assert.match(html, /handle\.addEventListener\('pointercancel',finishLayoutDrag\)/);
  assert.match(html, /function finishLayoutDrag\(event\)[\s\S]*activeLayoutDrag=null/);
  assert.match(html, /if\(editingLayout&&schematicView\.view!=='full'\)exitLayoutEditor\(\);/);
  assert.match(html, /window\.addEventListener\('hashchange',\(\)=>\{readCfg\(\);applyConfig\(\);\}\)/);
});

test('static schematic stays visible and guided step four advances to full circuit', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="schematic-canvas"[^>]*hidden/);
  assert.match(html, /canvas\.hidden=false/);
  assert.match(html, /guidedNext\.textContent=guided&&schematicView\.step===4\?'Ver circuito completo':'Próxima conexão'/);
  assert.match(html, /if\(schematicView\.step===4\)setSchematicView\('full',4\);/);
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
  assert.equal(layoutStorageKey({ tft: true, net: 'lte', power: 'xl4016' }), 'schematic-layout:v1:true:lte:xl4016');
  assert.equal(layoutStorageKey({}), 'schematic-layout:v1:false:wifi:lm2596');
  assert.equal(layoutStorageKey(null), 'schematic-layout:v1:false:wifi:lm2596');
});

test('saved layout is isolated by the electrical variant', () => {
  assert.notEqual(
    layoutStorageKey({ tft: false, net: 'lte', power: 'xl4016' }),
    layoutStorageKey({ tft: false, net: 'lte', power: 'lm2596' }),
  );
});

test('invalid saved coordinates fall back to default coordinates', () => {
  const result = sanitizePositions(
    { esp32: { x: -4, y: Number.NaN } },
    { esp32: { x: 520, y: 420 } },
  );
  assert.deepEqual(result.esp32, { x: 520, y: 420 });
});

test('saved coordinates outside the SVG canvas fall back to defaults', () => {
  const result = sanitizePositions(
    { esp32: { x: 1561, y: 420 } },
    { esp32: { x: 520, y: 420 } },
  );
  assert.deepEqual(result.esp32, { x: 520, y: 420 });
});

test('saved coordinates at SVG edges or beyond component bounds fall back to defaults', () => {
  const defaults = { esp32: { x: 520, y: 420 } };
  assert.deepEqual(sanitizePositions({ esp32: { x: 1560, y: 1210 } }, defaults).esp32, defaults.esp32);
  assert.deepEqual(
    sanitizePositions({ esp32: { x: 1361, y: 420 } }, defaults, { width: 1560, height: 985, positions: { esp32: { minX: 0, minY: 0, maxX: 1360, maxY: 800 } } }).esp32,
    defaults.esp32,
  );
});

test('every wire endpoint resolves to a real component-pin anchor', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const registeredAnchors = new Set([...html.matchAll(/data-anchor="([^"]+)"/g)].map(([, name]) => name));
  const registry = Object.fromEntries([...html.matchAll(/data-anchor="([^"]+)" cx="([^"]+)" cy="([^"]+)"/g)].map(([, name, x, y]) => [name, { x: Number(x), y: Number(y) }]));
  const wires = [...html.matchAll(/<path class="wire"[^>]*>/g)].map(([tag]) => tag);
  assert.equal(wires.length, 51);
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
  assert.deepEqual(anchorPosition('borne5xl.plus-rail'), { x: 190, y: 455 });
  assert.deepEqual(anchorPosition('display.vcc'), { x: 513, y: 1012 });
  assert.deepEqual(anchorPosition('rele.in1'), { x: 888, y: 420 });
  assert.deepEqual(anchorPosition('ima1.plus'), { x: 1340, y: 320 });
  assert.deepEqual(registry, ANCHORS);
});
