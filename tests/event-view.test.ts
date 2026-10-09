import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventView } from '../src/lib/event-view';
test('event presentation preserves enriched vision context and rejects unsafe media', () => {
  const payload = { kind: 'vision-review', source: 'ring', thumbnail: 'data:image/png;base64,aGVsbG8=', classification: { summary: 'Synthetic observation' }, observations: [{ type: 'person', value: 1, detected: true }] };
  const view = eventView({ observations: payload, aiAssessment: 'Synthetic AI summary' });
  assert.equal(view.source, 'ring'); assert.equal(view.aiSummary, 'Synthetic AI summary'); assert.equal(view.observations.length, 1); assert.ok(view.preview);
  for (const thumbnail of ['https://example.invalid/tracker.png', 'data:image/svg+xml;base64,aGVsbG8=', 'javascript:alert(1)']) assert.equal(eventView({ ...payload, thumbnail }).preview, '');
  assert.equal(eventView({ thumbnail: 'data:image/png;base64,' + 'a'.repeat(200001) }).preview, '');
});
test('synthetic readings remain clearly labeled and malformed payloads are safe', () => {
  const view = eventView({ signal: { type: 'smoke', value: 80, simulated: true }, assessment: 'Demonstration threshold exceeded' });
  assert.equal(view.synthetic, true); assert.equal(view.source, 'simulator'); assert.equal(view.signalValue, 80);
  assert.equal(eventView(null).preview, ''); assert.deepEqual(eventView({ observations: [null, {}] }).observations.map(x => x.value), [null, null]);
});
