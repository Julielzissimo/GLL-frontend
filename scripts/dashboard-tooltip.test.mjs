import assert from "node:assert/strict";
import test from "node:test";

const previousWindow = globalThis.window;
globalThis.window = {};
const { calculateFinanceTooltipPlacement } = await import("../web/dashboard.js");
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;

test("tooltip at the right edge uses its rendered width when placed to the left", () => {
  const placement = calculateFinanceTooltipPlacement({
    anchorLeft: 1047,
    anchorRight: 1073,
    contentLeft: 27,
    viewportWidth: 1105,
    edge: 12,
    gap: 8,
    maxWidth: 310,
  });

  assert.deepEqual(placement, { side: "left", left: 729, width: 310 });
  assert.ok(placement.left > 27);
  assert.equal(placement.left + placement.width, 1039);
});

test("tooltip prefers the right side when the viewport has usable space", () => {
  const placement = calculateFinanceTooltipPlacement({
    anchorLeft: 399,
    anchorRight: 425,
    contentLeft: 194,
    viewportWidth: 619,
    edge: 12,
    gap: 8,
    maxWidth: 310,
  });

  assert.deepEqual(placement, { side: "right", left: 433, width: 174 });
  assert.equal(placement.left + placement.width, 607);
});
