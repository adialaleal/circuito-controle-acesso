export const DEFAULT_LAYOUT = Object.freeze({
  fonte: { x: 40, y: 60, zone: 'power' },
  p4: { x: 304, y: 88, zone: 'power' },
  borne12: { x: 450, y: 55, zone: 'power' },
  bornegnd: { x: 450, y: 120, zone: 'power' },
  lm2596: { x: 50, y: 300, zone: 'power' },
  lm2596b: { x: 300, y: 250, zone: 'power' },
  xl4016: { x: 50, y: 290, zone: 'power' },
  borne5xl: { x: 50, y: 440, zone: 'power' },
  cap: { x: 356, y: 404, zone: 'power' },
  modem: { x: 220, y: 470, zone: 'control' },
  antena: { x: 232, y: 710, zone: 'control' },
  esp32: { x: 560, y: 300, zone: 'control' },
  rele: { x: 900, y: 330, zone: 'control' },
  d1: { x: 1312, y: 328, zone: 'outputs' },
  d2: { x: 1312, y: 488, zone: 'outputs' },
  d3: { x: 1312, y: 648, zone: 'outputs' },
  ima1: { x: 1340, y: 280, zone: 'outputs' },
  ima2: { x: 1340, y: 440, zone: 'outputs' },
  ima3: { x: 1340, y: 600, zone: 'outputs' },
  display: { x: 268, y: 1012, zone: 'outputs' },
});

export const STAGES = Object.freeze({
  1: ['fonte', 'p4', 'borne12', 'bornegnd', 'wire-01', 'wire-02', 'wire-06', 'wire-07'],
  2: ['lm2596', 'lm2596b', 'xl4016', 'borne5xl', 'cap', 'modem', 'antena', 'wire-03', 'wire-04', 'wire-05', 'wire-08', 'wire-09', 'wire-10', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33', 'wire-34', 'wire-35', 'wire-36', 'wire-37', 'wire-38', 'wire-39', 'wire-40', 'wire-41', 'wire-42', 'wire-43', 'wire-44', 'wire-45'],
  3: ['esp32', 'rele', 'wire-11', 'wire-12', 'wire-13', 'wire-14', 'wire-15', 'wire-16', 'wire-17', 'wire-18', 'wire-19'],
  4: ['d1', 'd2', 'd3', 'ima1', 'ima2', 'ima3', 'display', 'wire-20', 'wire-21', 'wire-22', 'wire-23', 'wire-24', 'wire-25', 'wire-26', 'wire-27', 'wire-46', 'wire-47', 'wire-48'],
});

const LTE_ONLY_IDS = new Set(['lm2596b', 'cap', 'modem', 'antena', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33', 'wire-42', 'wire-43', 'wire-44', 'wire-45']);
const LM_POWER_IDS = new Set(['lm2596', 'lm2596b', 'wire-28', 'wire-29', 'wire-30', 'wire-31', 'wire-32', 'wire-33']);
const XL_POWER_IDS = new Set(['xl4016', 'borne5xl', 'wire-34', 'wire-35', 'wire-36', 'wire-37', 'wire-38', 'wire-39', 'wire-40', 'wire-41']);
const TFT_ONLY_IDS = new Set(['display', 'wire-20', 'wire-21', 'wire-22', 'wire-23', 'wire-24', 'wire-25', 'wire-26', 'wire-27']);

export const ANCHORS = Object.freeze({
  'fonte.p4-plus': { x: 220, y: 125 }, 'p4.input': { x: 286, y: 125 }, 'p4.out-plus': { x: 410, y: 110 }, 'p4.out-ground': { x: 410, y: 145 },
  'borne12.in-plus': { x: 450, y: 110 }, 'borne12.out-plus': { x: 480, y: 103 }, 'borne12.lock-plus': { x: 620, y: 78 }, 'borne12.lock1-rail': { x: 1210, y: 390 }, 'borne12.lock2-rail': { x: 1210, y: 490 }, 'borne12.lte-plus': { x: 340, y: 210 },
  'bornegnd.in-ground': { x: 450, y: 145 }, 'bornegnd.out-ground': { x: 520, y: 168 }, 'bornegnd.ground-rail': { x: 620, y: 145 }, 'bornegnd.lte-ground': { x: 400, y: 230 },
  'lm2596.in-plus': { x: 100, y: 300 }, 'lm2596.in-ground': { x: 160, y: 300 }, 'lm2596.out-plus': { x: 100, y: 430 }, 'lm2596.out-ground': { x: 160, y: 430 }, 'lm2596.5v-rail': { x: 520, y: 860 },
  'lm2596b.in-plus': { x: 340, y: 250 }, 'lm2596b.in-ground': { x: 400, y: 250 }, 'lm2596b.out-plus': { x: 340, y: 420 }, 'lm2596b.modem-plus': { x: 340, y: 380 }, 'lm2596b.out-ground': { x: 400, y: 380 },
  'xl4016.input-rail': { x: 100, y: 430 }, 'xl4016.in-plus': { x: 100, y: 440 }, 'xl4016.in-ground': { x: 160, y: 430 }, 'xl4016.out-plus': { x: 190, y: 455 }, 'xl4016.out-ground': { x: 190, y: 495 }, 'xl4016.modem-plus': { x: 340, y: 420 }, 'xl4016.modem-ground': { x: 400, y: 420 },
  'borne5xl.ground': { x: 160, y: 480 }, 'cap.plus': { x: 356, y: 420 }, 'cap.ground': { x: 384, y: 420 },
  'modem.vin': { x: 340, y: 470 }, 'modem.ground': { x: 400, y: 470 }, 'modem.ground-cap': { x: 400, y: 420 }, 'modem.uart-tx': { x: 475, y: 530 }, 'modem.uart-rx': { x: 475, y: 560 }, 'modem.pwrkey': { x: 475, y: 590 }, 'modem.reset': { x: 475, y: 620 },
  'esp32.vin': { x: 548, y: 770 }, 'esp32.ground': { x: 548, y: 740 }, 'esp32.ground-out': { x: 772, y: 740 }, 'esp32.3v3': { x: 772, y: 770 }, 'esp32.gpio22': { x: 772, y: 380 }, 'esp32.gpio21': { x: 772, y: 470 }, 'esp32.gpio16': { x: 772, y: 620 },
  'esp32.display-vcc': { x: 700, y: 860 }, 'esp32.display-ground': { x: 660, y: 960 }, 'esp32.spi-sdi': { x: 772, y: 710 }, 'esp32.spi-sck': { x: 772, y: 650 }, 'esp32.spi-dc': { x: 772, y: 680 }, 'esp32.spi-cs': { x: 772, y: 350 }, 'esp32.spi-reset': { x: 772, y: 530 }, 'esp32.display-led': { x: 780, y: 770 },
  'esp32.gpio33': { x: 544, y: 530 }, 'esp32.gpio25': { x: 544, y: 560 }, 'esp32.gpio26': { x: 544, y: 590 }, 'esp32.gpio27': { x: 544, y: 620 },
  'rele.power-rail': { x: 1192, y: 590 }, 'rele.lock1-input': { x: 1192, y: 390 }, 'rele.lock2-input': { x: 1192, y: 490 }, 'rele.nc1': { x: 1192, y: 420 }, 'rele.nc2': { x: 1192, y: 520 }, 'rele.nc3': { x: 1192, y: 620 }, 'rele.ground': { x: 888, y: 380 }, 'rele.vcc': { x: 888, y: 580 }, 'rele.vcc-rail': { x: 988, y: 782 }, 'rele.in1': { x: 888, y: 420 }, 'rele.in2': { x: 888, y: 460 }, 'rele.in3': { x: 888, y: 500 },
  'display.vcc': { x: 513, y: 1012 }, 'display.ground': { x: 513, y: 1030 }, 'display.sdi': { x: 513, y: 1048 }, 'display.sck': { x: 513, y: 1066 }, 'display.dc': { x: 513, y: 1084 }, 'display.cs': { x: 513, y: 1102 }, 'display.reset': { x: 513, y: 1120 }, 'display.led': { x: 513, y: 1138 },
  'ima1.plus': { x: 1340, y: 320 }, 'ima1.ground': { x: 1340, y: 355 }, 'ima2.ground-rail': { x: 1316, y: 515 }, 'ima2.plus': { x: 1340, y: 480 }, 'ima2.ground': { x: 1340, y: 515 }, 'ima3.ground-rail': { x: 1316, y: 675 }, 'ima3.plus': { x: 1340, y: 640 }, 'ima3.ground': { x: 1340, y: 675 },
});

function normalizedVariant(variant = {}) {
  return {
    tft: variant.tft === true,
    net: ['wifi', 'dual', 'lte'].includes(variant.net) ? variant.net : 'wifi',
    power: ['lm2596', 'xl4016'].includes(variant.power) ? variant.power : 'lm2596',
  };
}

export function normalizeView(hash = {}) {
  const step = Number.parseInt(hash.step, 10);
  return {
    view: hash.view === 'full' ? 'full' : 'guided',
    step: Math.min(4, Math.max(1, Number.isNaN(step) ? 1 : step)),
  };
}

export function visibleIds(stage, variant) {
  const selected = normalizedVariant(variant);
  const lastStage = Math.min(4, Math.max(1, Number.parseInt(stage, 10) || 1));
  const ids = new Set();
  for (let index = 1; index <= lastStage; index += 1) {
    STAGES[index].forEach((id) => ids.add(id));
  }

  if (selected.net === 'wifi') {
    LTE_ONLY_IDS.forEach((id) => ids.delete(id));
  }
  if (!selected.tft) {
    TFT_ONLY_IDS.forEach((id) => ids.delete(id));
  }
  if (selected.power === 'xl4016') {
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
  const selected = normalizedVariant(variant);
  return `schematic-layout:${selected.tft ? 'tft' : 'plain'}:${selected.net}:${selected.power}`;
}

export function anchorPosition(name) {
  return ANCHORS[name];
}
