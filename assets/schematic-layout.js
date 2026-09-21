export const DEFAULT_LAYOUT = Object.freeze({
  fonte: { x: 40, y: 60, zone: 'power' },
  p4: { x: 304, y: 88, zone: 'power' },
  borne12: { x: 450, y: 55, zone: 'power' },
  bornegnd: { x: 450, y: 120, zone: 'power' },
  lm2596: { x: 50, y: 300, zone: 'power' },
  lm2596b: { x: 312, y: 260, zone: 'power' },
  xl4016: { x: 40, y: 440, zone: 'power' },
  borne5xl: { x: 100, y: 440, zone: 'power' },
  cap: { x: 356, y: 400, zone: 'power' },
  modem: { x: 400, y: 470, zone: 'control' },
  antena: { x: 232, y: 710, zone: 'control' },
  esp32: { x: 548, y: 330, zone: 'control' },
  rele: { x: 888, y: 340, zone: 'control' },
  d1: { x: 1240, y: 280, zone: 'outputs' },
  d2: { x: 1240, y: 440, zone: 'outputs' },
  d3: { x: 1240, y: 600, zone: 'outputs' },
  ima1: { x: 1340, y: 280, zone: 'outputs' },
  ima2: { x: 1340, y: 440, zone: 'outputs' },
  ima3: { x: 1340, y: 600, zone: 'outputs' },
  display: { x: 268, y: 1012, zone: 'outputs' },
});

export const STAGES = Object.freeze({
  1: ['fonte', 'p4', 'borne12', 'bornegnd', 'wire-01', 'wire-02', 'wire-06', 'wire-07'],
  2: ['lm2596', 'lm2596b', 'xl4016', 'borne5xl', 'cap', 'modem', 'antena', 'wire-03', 'wire-04', 'wire-05', 'wire-08', 'wire-09', 'wire-10', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33', 'wire-34', 'wire-35', 'wire-36', 'wire-37', 'wire-38', 'wire-39', 'wire-40', 'wire-41', 'wire-42', 'wire-43', 'wire-44', 'wire-45'],
  3: ['esp32', 'rele', 'wire-11', 'wire-12', 'wire-13', 'wire-14', 'wire-15', 'wire-16'],
  4: ['d1', 'd2', 'd3', 'ima1', 'ima2', 'ima3', 'display', 'wire-17', 'wire-18', 'wire-19'],
});

const LTE_ONLY_IDS = new Set(['lm2596b', 'cap', 'modem', 'antena', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33', 'wire-42', 'wire-43', 'wire-44', 'wire-45']);
const LM_POWER_IDS = new Set(['lm2596', 'lm2596b', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33']);
const XL_POWER_IDS = new Set(['xl4016', 'borne5xl', 'wire-34', 'wire-35', 'wire-36', 'wire-37', 'wire-38', 'wire-39', 'wire-40', 'wire-41']);

export function normalizeView(hash = {}) {
  const step = Number.parseInt(hash.step, 10);
  return {
    view: hash.view === 'full' ? 'full' : 'guided',
    step: Math.min(4, Math.max(1, Number.isNaN(step) ? 1 : step)),
  };
}

export function visibleIds(stage, variant) {
  const lastStage = Math.min(4, Math.max(1, Number.parseInt(stage, 10) || 1));
  const ids = new Set();
  for (let index = 1; index <= lastStage; index += 1) {
    STAGES[index].forEach((id) => ids.add(id));
  }

  if (variant.net === 'wifi') {
    LTE_ONLY_IDS.forEach((id) => ids.delete(id));
  }
  if (variant.power === 'xl4016') {
    LM_POWER_IDS.forEach((id) => ids.delete(id));
  } else {
    XL_POWER_IDS.forEach((id) => ids.delete(id));
  }
  return [...ids];
}

export function routeOrthogonal(from, to, lane) {
  if (from.y === to.y) return `M${from.x},${from.y} H${to.x}`;
  if (from.x === to.x) return `M${from.x},${from.y} V${to.y}`;
  return `M${from.x},${from.y} H${lane} V${to.y} H${to.x}`;
}

export function layoutStorageKey(variant) {
  return `schematic-layout:${variant.tft ? 'tft' : 'plain'}:${variant.net}:${variant.power}`;
}
