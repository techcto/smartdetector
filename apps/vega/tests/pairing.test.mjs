import test from "node:test";
import assert from "node:assert/strict";
import { pairingUrl, qrRuns } from "../src/pairing.mjs";
test("QR contains only the public pairing code and a validated service origin", () => {
  const link = pairingUrl("https://smartdetector.com", "ABCDE-12345");
  assert.equal(link, "https://smartdetector.com/tv/connect?code=ABCDE-12345");
  for (const code of ["ABCDE-12345.secret", "wrong", "ABCDE-12345&next=evil"])
    assert.throws(() => pairingUrl("https://smartdetector.com", code));
  assert.throws(() => pairingUrl("http://public.example", "ABCDE-12345"));
  const qr = qrRuns(link);
  assert.ok(qr.size >= 21);
  assert.equal(qr.rows.length, qr.size);
  for (const row of qr.rows)
    for (const run of row)
      assert.ok(
        run.start >= 0 && run.length > 0 && run.start + run.length <= qr.size
      );
  // Finder pattern in the upper-left corner.
  assert.deepEqual(qr.rows[0][0], { start: 0, length: 7 });
});
