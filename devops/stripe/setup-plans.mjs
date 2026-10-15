import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

export const plans = [
  { id: 'starter', name: 'SmartDetector Starter', cents: 4900, devices: 5, env: 'STRIPE_STARTER_PRICE_ID' },
  { id: 'scale', name: 'SmartDetector Scale', cents: 19900, devices: 50, env: 'STRIPE_SCALE_PRICE_ID' },
];
// Shown in the Checkout order summary. Keep descriptions factual: what the plan includes, nothing promised beyond the app.
const describe = devices => `Up to ${devices} devices: camera and sensor events, AutoVision person and object detection, event history with image review, and alert notifications. Cancel anytime.`;

// Creates or reuses a product and keeps its Checkout display (name, description, image) current. Prices are never changed here.
async function ensureProduct(client, id, display, metadata, image) {
  let product;
  try { product = await client.products.retrieve(id); }
  catch (error) {
    if (error.code !== 'resource_missing') throw error;
    product = await client.products.create({ id, ...display, metadata }, { idempotencyKey: `${id}_create` });
  }
  if (product.deleted || !product.active) throw new Error(`Unavailable product: ${id}`);
  // Checkout branding needs the logo as a Stripe file ID (logo_file); the product image needs its public link.
  const logo = product.images?.length && product.metadata?.logo_file ? undefined : await image?.();
  if (product.name !== display.name || product.description !== display.description || logo)
    product = await client.products.update(id, { ...display, ...(logo ? { images: [logo.url], metadata: { ...product.metadata, logo_file: logo.file } } : {}) });
  return product;
}

// image: optional { data, name } uploaded once to Stripe and used as the product image via a public file link.
export async function setup(client, image) {
  const output = {};let imageUrl;
  const productImage = image && (async () => imageUrl ??= await (async () => { const file = (await client.files.create({ purpose: 'business_logo', file: { data: image.data, name: image.name, type: 'application/octet-stream' } })).id; return { file, url: (await client.fileLinks.create({ file })).url }; })());
  for (const plan of plans) {
    const id = `smartdetector_${plan.id}_v1`;
    await ensureProduct(client, id, { name: plan.name, description: describe(plan.devices) }, { application: 'smartdetector', included_devices: String(plan.devices) }, productImage);
    const lookup_key = `${id}_usd_monthly`;
    let price = (await client.prices.list({ lookup_keys: [lookup_key], limit: 2 })).data[0];
    if (price && (!price.active || price.product !== id || price.currency !== 'usd' ||
      price.unit_amount !== plan.cents || price.recurring?.interval !== 'month' ||
      price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== 'licensed')) {
      throw new Error(`Price conflict: ${lookup_key}; review manually`);
    }
    if (!price) price = await client.prices.create({ product: id, currency: 'usd',
      unit_amount: plan.cents, recurring: { interval: 'month' }, lookup_key },
    { idempotencyKey: `${lookup_key}_create` });
    output[plan.env] = price.id;
  }
  return output;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--live'].includes(arg))) throw new Error('Usage: setup-plans.mjs [--apply [--live]]');
  if (!args.includes('--apply')) console.log(JSON.stringify({ mode: 'offline preview', plans }, null, 2));
  else {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !/^(sk|rk)_(test|live)_/.test(key)) throw new Error('A Stripe secret or restricted key is required');
    if (key.includes('_live_') && !args.includes('--live')) throw new Error('Live setup requires --apply --live');
    const logo = new URL('../../public/smartdetector-logo-marketplace-640.png', import.meta.url);
    console.log(JSON.stringify(await setup(new Stripe(key), { data: readFileSync(logo), name: 'smartdetector-logo.png' }), null, 2));
  }
}
