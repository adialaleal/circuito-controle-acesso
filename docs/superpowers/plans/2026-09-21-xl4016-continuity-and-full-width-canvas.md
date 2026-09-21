# XL4016 Continuity and Full-Width Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the XL4016 output visibly continuous to its Wagos and free the 2D schematic canvas to use the page width.

**Architecture:** Keep the existing SVG topology and only correct the terminal-facing path geometry for the XL4016/Wago pair. Change the 2D page layout from canvas-plus-sidebar to a full-width canvas preceded by a horizontal inspector/configuration strip; preserve DOM IDs and inspector behavior.

**Tech Stack:** HTML, CSS, SVG, JavaScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-21-xl4016-continuity-and-full-width-canvas-design.md`

## Global Constraints

- Do not alter pins, components, connection tables, firmware, or electrical topology.
- Preserve guided, full and layout-editor modes.
- In XL4016 guided step 2, show both direct XL4016-to-Wago connections with the Wagos and valid destinations.
- Keep inspector focus, hover and click behavior usable on narrow screens.

## Review Focus

- XL4016 OUT+/OUT− wires must touch Wago terminals, not merely cross their bounding boxes. Test owned anchor coordinates in `tests/schematic-layout.test.mjs`.
- Desktop canvas must no longer be constrained by a permanent inspector column. Assert the 2D layout class/CSS no longer uses the old two-column grid.
- Narrow screens must stack the inspector strip before the horizontally-scrollable canvas. Assert the responsive rule exists.
- Guided/full/editor controls and SVG IDs must remain unchanged. Run the existing 28-test suite and inline-script syntax check.

---

### Task 1: Correct XL4016 terminal continuity and reflow the 2D page

**Files:**
- Modify: `index.html: 2D layout CSS, inspector/container markup, XL4016 SVG paths`
- Modify: `tests/schematic-layout.test.mjs: XL4016 anchor and layout contract assertions`

**Interfaces:**
- Consumes existing `xl4016.output-plus`, `xl4016.output-ground`, `borne5xl.plus`, and `borne5xl.ground` anchors.
- Produces the same inspector IDs (`inspector`, `insp-title`, `insp-desc`, `insp-list`) and same `#schematic` API for existing handlers.

- [ ] **Step 1: Write the failing continuity/layout test**

```js
test('XL4016 outputs connect directly to the two Wagos and the canvas is full width', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-wire-id="wire-34"[\s\S]*d="M100,430 V440"/);
  assert.match(html, /data-wire-id="wire-37"[\s\S]*d="M160,430 V480"/);
  assert.match(html, /\.schematic-layout\{display:block/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/schematic-layout.test.mjs`

Expected: FAIL because the current document has no full-width layout contract and the test’s layout selector is absent.

- [ ] **Step 3: Implement minimal SVG and page-layout change**

Keep wire 34 (`OUT+` to Wago +5V) and wire 37 (`OUT−` to Wago GND) as direct vertical terminal-to-terminal paths; add visible terminal dots if necessary, without changing their anchors or net names. Move the existing `<aside>` inside a new full-width `.schematic-inspector-strip` above `.canvas-wrap`; use a horizontal grid for inspector/configuration/net sections on desktop and one column below the narrow breakpoint. Set the schematic layout wrapper to one column and canvas to `width:100%`. Do not rename inspector IDs, SVG IDs, controls, or event bindings.

- [ ] **Step 4: Run focused and full validation**

Run: `node --test tests/schematic-layout.test.mjs && awk '/<script>/{on=1;next} /<\/script>/{on=0} on{print}' index.html > /tmp/circuito-script.js && node --check /tmp/circuito-script.js && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/schematic-layout.test.mjs
git commit -m "fix: clarify XL4016 output and widen schematic canvas"
```

## Self-Review

- Spec coverage: Task 1 covers direct terminal continuity, full-width canvas, upper inspector, responsive stacking and all requested preservation constraints.
- Placeholder scan: no deferred work or ambiguous steps remain.
- Interface consistency: all existing inspector and SVG IDs stay unchanged.
- Review focus: the Task 1 test and full existing test suite cover continuity, layout contract, responsive CSS and regressions.
