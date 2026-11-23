import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, gradeColor, weekday } from "./format.ts";

test("grade colour matches both sheets' spellings", () => {
  for (const g of ["COMISAR ȘEF", "COMISAR-SEF", "Comisar-șef", "CHESTOR GENERAL"]) assert.equal(gradeColor(g).bg, "#0A2472");
  assert.equal(gradeColor("AGENT ȘEF PRINCIPAL").bg, "#1155CC");
  assert.equal(gradeColor("AGENT").bg, "#3F7BE0");
});

test("calendar helpers don't shift with the local timezone", () => {
  assert.equal(weekday("2026-11-22"), "Du");
  assert.equal(addDays("2026-11-28", 1), "2026-11-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
});
