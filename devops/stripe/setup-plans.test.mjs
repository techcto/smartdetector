import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './setup-plans.mjs';

function fakeStripe() {
  const products = new Map(), prices = [], updates = [], uploads = [];
  const client = {
    files: { create: async v => { uploads.push(v.purpose); return { id: 'file_1' }; } },
    fileLinks: { create: async () => ({ url: 'https://files.stripe.com/links/logo' }) },
    products: {
      retrieve: async id => { if (!products.has(id)) throw Object.assign(new Error('missing'), { code: 'resource_missing' }); return products.get(id); },
      create: async value => { const p = { ...value, active: true }; products.set(p.id, p); return p; },
      update: async (id, value) => { const p = { ...products.get(id), ...value }; products.set(id, p); updates.push(id); return p; },
    },
    prices: {
      list: async ({ lookup_keys }) => ({ data: prices.filter(p => lookup_keys.includes(p.lookup_key)) }),
      create: async value => { const p = { ...value, id: `price_${prices.length}`, active: true,
        recurring: { usage_type: 'licensed', ...value.recurring, interval_count: 1 } }; prices.push(p); return p; },
    },
  };
  return { client, products, prices, updates, uploads };
}

test('setup reuses plans without duplicating resources', async () => {
  const { client, products, prices } = fakeStripe();
  const first = await setup(client);
  assert.deepEqual(await setup(client), first);
  assert.equal(products.size, 2);
  assert.equal(prices.length, 2);
  assert.deepEqual(prices.map(p => p.unit_amount), [4900, 19900]);
});

test('products get Checkout names, descriptions and one uploaded logo, updated in place on rerun', async () => {
  const { client, products, updates, uploads } = fakeStripe();
  products.set('smartdetector_starter_v1', { id: 'smartdetector_starter_v1', name: 'SmartDetector starter', active: true, images: [] });
  await setup(client, { data: Buffer.from('png'), name: 'logo.png' });
  const starter = products.get('smartdetector_starter_v1');
  assert.equal(starter.name, 'SmartDetector Starter');
  assert.match(starter.description, /Up to 5 devices/);
  assert.deepEqual(starter.images, ['https://files.stripe.com/links/logo']);
  assert.equal(starter.metadata.logo_file, 'file_1');
  assert.deepEqual(uploads, ['business_logo'], 'logo uploaded once and reused');
  const before = updates.length;
  await setup(client, { data: Buffer.from('png'), name: 'logo.png' });
  assert.equal(updates.length, before, 'no updates when display is already current');
});
