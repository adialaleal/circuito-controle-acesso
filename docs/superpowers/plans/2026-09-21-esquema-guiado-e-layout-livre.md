# Esquema guiado e layout livre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o esquema elétrico legível em quatro etapas e permitir organizar os módulos do circuito completo sem alterar conexões.

**Architecture:** Extrair a decisão de etapa, posições e roteamento ortogonal para um módulo JavaScript testável. `index.html` continua dono do SVG, do configurador e do inspetor, mas passa a declarar âncoras nos componentes e a delegar filtros/rotas ao módulo. O editor move grupos de componentes, recalcula caminhos e persiste somente posições locais por variante.

**Tech Stack:** HTML, CSS, SVG, JavaScript ES modules, `node:test` e GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-21-esquema-guiado-e-layout-livre-design.md`

## Global Constraints

- Não mudar topologia elétrica, pinos, firmware ou tabela pino a pino.
- Preservar `tft`, `net`, `ap` e `power` no hash existente; adicionar somente `view=guided|full` e `step=1..4`.
- O XL4016 deve manter o par explícito `OUT+ → Wago +5V` e `OUT− → Wago GND`, com capacitor junto ao modem.
- O editor nunca move fios isolados, cria conexões ou exporta netlist.
- Posições editadas ficam apenas em `localStorage`, isoladas por variante; links compartilhados não carregam posições.
- Em touch, apenas a alça inicia arraste; o corpo do componente continua abrindo o inspetor.

## Review Focus

- Hash antigo sem `view`/`step` deve abrir no modo guiado, etapa 1, sem quebrar o configurador existente. Coberto na Task 1.
- A etapa 2 em `net=lte&power=xl4016` deve revelar ambos Wagos e todos os destinos de 5 V; o modem não pode surgir em Wi-Fi. Coberto na Task 2.
- Rota entre âncoras alinhadas ou invertidas não pode gerar segmentos de tamanho zero. Coberto na Task 1.
- Mudar tela, rede ou alimentação enquanto o editor está ativo deve sair do editor e não reutilizar posições incompatíveis. Coberto na Task 3.
- Toque no corpo de um componente deve inspecionar; somente pointerdown na alça pode mover. Coberto na Task 3.

---

### Task 1: Modelo testável de etapas, layouts e rotas

**Files:**
- Create: `assets/schematic-layout.js`
- Create: `tests/schematic-layout.test.mjs`
- Modify: `index.html: scripts and SVG component metadata`

**Interfaces:**
- Produces `normalizeView(hash)`, `visibleIds(stage, variant)`, `routeOrthogonal(from, to, lane)`, `layoutStorageKey(variant)` and `DEFAULT_LAYOUT`.
- Consumes `variant = {tft:boolean, net:'wifi'|'dual'|'lte', power:'lm2596'|'xl4016'}` from `index.html`.
- Task 2 consumes `visibleIds` to filter SVG groups and `routeOrthogonal` to set `path[d]`.

- [ ] **Step 1: Write failing tests for deterministic state and routing**

```js
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
  assert.equal(routeOrthogonal({x:10,y:10}, {x:80,y:10}, 40), 'M10,10 H80');
  assert.equal(routeOrthogonal({x:10,y:10}, {x:80,y:90}, 40), 'M10,10 H40 V90 H80');
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `node --test tests/schematic-layout.test.mjs`

Expected: FAIL because `assets/schematic-layout.js` does not exist.

- [ ] **Step 3: Implement the declarative model**

Create `assets/schematic-layout.js` as an ES module. Define stage membership in a `STAGES` object keyed `1` through `4`; each value is an array of component IDs and network IDs. `visibleIds` must union previous stages and remove LTE-only IDs when `net === 'wifi'`; it must select `xl4016`/`borne5xl` or `lm2596`/`lm2596b` based on `power`. `routeOrthogonal` must return direct horizontal/vertical SVG paths when possible, otherwise `M x,y H lane V targetY H targetX`. `normalizeView` must clamp a parsed step from 1 to 4 and default to guided/1. Keep the fixed full-layout coordinates in `DEFAULT_LAYOUT` with zones `power`, `control`, and `outputs`.

- [ ] **Step 4: Add SVG metadata without changing electrical SVG paths yet**

Give every movable `.comp` a stable `data-layout-id`, `data-zone`, and a child `.drag-handle` with `data-drag-handle`. Give every reroutable wire a stable `data-wire-id`, `data-from` and `data-to` anchor names. Keep the existing paths intact so the current full schematic remains functional before Task 2.

- [ ] **Step 5: Run tests and static validation**

Run: `node --test tests/schematic-layout.test.mjs && git diff --check`

Expected: PASS; no whitespace errors.

- [ ] **Step 6: Commit the model**

```bash
git add assets/schematic-layout.js tests/schematic-layout.test.mjs index.html
git commit -m "feat: add schematic view and routing model"
```

### Task 2: Controles e visualização guiada

**Files:**
- Modify: `index.html: header controls, SVG layers, CSS and configuration script`
- Test: `tests/schematic-layout.test.mjs`

**Interfaces:**
- Consumes `normalizeView`, `visibleIds`, `DEFAULT_LAYOUT` from Task 1.
- Produces `applySchematicView()` and `setSchematicView(view, step)` called by Task 3 before/after editor state changes.

- [ ] **Step 1: Extend the failing test with exact stage visibility**

```js
test('guided stages are cumulative and hide output locks before step 4', () => {
  const step3 = visibleIds(3, { tft: false, net: 'lte', power: 'xl4016' });
  assert.ok(step3.includes('esp32') && step3.includes('modem') && step3.includes('rele'));
  assert.ok(!step3.includes('lock1') && !step3.includes('lock2') && !step3.includes('lock3'));
  assert.ok(visibleIds(4, { tft: false, net: 'lte', power: 'xl4016' }).includes('lock3'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/schematic-layout.test.mjs`

Expected: FAIL because stage 3/4 membership is not fully declared.

- [ ] **Step 3: Add the guided UI and fixed full layout**

Add a compact control strip above the SVG: `Montagem guiada`, `Circuito completo`, an ordered four-step indicator, `Voltar` and `Próxima conexão`. In guided mode, call `visibleIds` and set `hidden` on non-applicable component/wire groups; set the side panel heading and explanation from a four-entry `GUIDED_COPY` map. In full mode, position component groups from `DEFAULT_LAYOUT`, show zone labels and use `routeOrthogonal` to replace only wires marked reroutable. Update `view`/`step` in `history.replaceState` alongside the existing configuration hash.

- [ ] **Step 4: Make the view readable at desktop and touch widths**

Add CSS for `.schematic-mode`, `.guided-stepper`, `.zone-label`, `.is-stage-hidden`, `.drag-handle` and `prefers-reduced-motion`. On narrow widths, stack the controls before the horizontally scrollable SVG; never shrink the SVG below its readable minimum. Use `hidden`/`aria-hidden` for excluded stage objects and `aria-pressed` for mode/step buttons.

- [ ] **Step 5: Run focused verification**

Run: `node --test tests/schematic-layout.test.mjs && node --check /tmp/circuito-script.js && git diff --check`

Prepare `/tmp/circuito-script.js` with the existing extraction command: `awk '/<script>/{on=1;next} /<\/script>/{on=0} on{print}' index.html > /tmp/circuito-script.js`.

Expected: all tests and syntax checks PASS.

- [ ] **Step 6: Manually verify three supported configurations**

Open `#tft=0&net=wifi&ap=0&power=xl4016`, `#tft=0&net=lte&ap=0&power=lm2596`, and `#tft=0&net=lte&ap=0&power=xl4016`. Verify respectively: no modem in guided steps; two LM2596 modules in full view; XL4016 plus both Wagos and capacitor in step 2.

- [ ] **Step 7: Commit guided and full modes**

```bash
git add index.html assets/schematic-layout.js tests/schematic-layout.test.mjs
git commit -m "feat: add guided schematic steps and full layout"
```

### Task 3: Editor de layout com persistência local

**Files:**
- Modify: `index.html: editor controls, pointer handlers and configuration reset`
- Modify: `assets/schematic-layout.js: serialize/validate positions`
- Modify: `tests/schematic-layout.test.mjs`

**Interfaces:**
- Consumes `DEFAULT_LAYOUT`, `layoutStorageKey`, `routeOrthogonal` and `applySchematicView()`.
- Produces `enterLayoutEditor()`, `exitLayoutEditor()`, `restoreLayout()` and `applyLayout(positions)`.

- [ ] **Step 1: Write failing persistence and bounds tests**

```js
import { layoutStorageKey, sanitizePositions } from '../assets/schematic-layout.js';

test('saved layout is isolated by the electrical variant', () => {
  assert.notEqual(
    layoutStorageKey({ tft:false, net:'lte', power:'xl4016' }),
    layoutStorageKey({ tft:false, net:'lte', power:'lm2596' })
  );
});

test('invalid saved coordinates fall back to default coordinates', () => {
  const result = sanitizePositions({ esp32: { x: -4, y: Number.NaN } }, { esp32: { x: 520, y: 420 } });
  assert.deepEqual(result.esp32, { x: 520, y: 420 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/schematic-layout.test.mjs`

Expected: FAIL because `layoutStorageKey` and `sanitizePositions` are not exported.

- [ ] **Step 3: Implement editor state and safe persistence**

Add `layoutStorageKey(variant)` using `schematic-layout:v1:<tft>:<net>:<power>`. Add `sanitizePositions(saved, defaults)` that accepts finite non-negative `x`/`y` values inside the SVG canvas and substitutes each invalid item from defaults. Add `editingLayout` state in `index.html`; `enterLayoutEditor` requires full view, shows grid/handles and loads sanitized positions; `exitLayoutEditor` hides handles; `restoreLayout` removes only the current key and reapplies defaults.

- [ ] **Step 4: Implement pointer interactions without stealing inspection**

Register `pointerdown` only on `[data-drag-handle]`. Capture the pointer, transform `clientX/clientY` through `svg.createSVGPoint()` and the inverse screen CTM, snap to a 20-unit grid, clamp to canvas bounds, update the matching component group transform, then call `applyLayout` to reroute attached wires. Do not call `preventDefault` on component-body click. On `pointerup`/`pointercancel`, release capture and serialize positions with `localStorage.setItem`.

- [ ] **Step 5: Reset editor on electrical variant change**

In `applyConfig`, if the `tft`, `net` or `power` fingerprint differs from the fingerprint at editor entry, call `exitLayoutEditor()` and `applySchematicView()` with `DEFAULT_LAYOUT`. Keep local saved layouts untouched for their original variant.

- [ ] **Step 6: Run tests and manual interaction checks**

Run: `node --test tests/schematic-layout.test.mjs && git diff --check`

Then, in `#tft=0&net=lte&ap=0&power=xl4016`: enter full view, move ESP32 by its handle, reload and verify its position persists; click the ESP32 body and verify the inspector opens; use restore and verify defaults return; switch to Wi-Fi and verify editing exits.

- [ ] **Step 7: Commit layout editor**

```bash
git add index.html assets/schematic-layout.js tests/schematic-layout.test.mjs
git commit -m "feat: add draggable schematic layout editor"
```

### Task 4: Publicação e aceitação visual

**Files:**
- Modify: `README.md: configuration and interaction notes`
- Test: `tests/schematic-layout.test.mjs`

**Interfaces:**
- Consumes all completed interface functions and GitHub Pages deployment from Tasks 1–3.
- Produces a documented, publicly verified release.

- [ ] **Step 1: Document the user-facing modes**

Update the README configuration section with the three modes, the four guided stages, URL state (`view` and `step`), and the distinction between shareable view state and local-only layout positions. State that dragging changes no electrical connection.

- [ ] **Step 2: Run full local gate**

Run: `node --test tests/schematic-layout.test.mjs && awk '/<script>/{on=1;next} /<\/script>/{on=0} on{print}' index.html > /tmp/circuito-script.js && node --check /tmp/circuito-script.js && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 3: Perform visual acceptance**

At desktop and iPad-width viewport, inspect all four guided stages and the full layout for the XL4016 variant. Confirm every claimed Wago junction has a visibly continuous wire, the component bodies are not crossed by unconnected wires, and the editor’s moved wire endpoints follow the moved component.

- [ ] **Step 4: Commit and publish**

```bash
git add README.md index.html assets/schematic-layout.js tests/schematic-layout.test.mjs
git commit -m "docs: document guided schematic controls"
git push origin main
```

- [ ] **Step 5: Verify deployed behavior, not only push status**

Fetch `https://adialaleal.github.io/circuito-controle-acesso/?v=<commit>` and confirm the response contains `Montagem guiada`, `Organizar layout`, and `schematic-layout:v1`. Open the published XL4016 hash and verify the guided controls appear.

## Self-Review

- Spec coverage: Tasks 1–2 implement modes, stages, zones, hash and accessibility; Task 3 implements drag, routing, touch behavior, local persistence/reset; Task 4 covers documentation, full gates, visual review and deployed verification.
- Placeholder scan: no TBD/TODO or deferred implementation language remains.
- Type consistency: `variant`, `normalizeView`, `visibleIds`, `routeOrthogonal`, `layoutStorageKey`, `sanitizePositions`, `applySchematicView` and editor methods use the same names through all tasks.
- Review focus: each listed failure condition has a named test or manual acceptance step in its owning task.
