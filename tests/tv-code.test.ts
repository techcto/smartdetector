import test from "node:test";
import assert from "node:assert/strict";
import { formatTvCode, completeTvCode } from "../src/lib/tv-code";
test("TV input formats uppercase groups without requiring the user to type a dash", () => {
  for (const value of ["3cf451ba2a", "3cf45-1ba2a", " 3cf45 1ba2a "])
    assert.equal(formatTvCode(value), "3CF45-1BA2A");
  assert.equal(formatTvCode("abcde"), "ABCDE");
  assert.equal(formatTvCode("abcde1"), "ABCDE-1");
  assert.equal(formatTvCode("ABCDE-"), "ABCDE");
  assert.equal(formatTvCode(""), "");
  assert.ok(completeTvCode(formatTvCode("3cf451ba2a")));
  for (const value of ["ABCDE", "ABCDE-1234", "GBCDE-12345"])
    assert.equal(completeTvCode(formatTvCode(value)), false);
});
