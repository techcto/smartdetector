import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of [
    ['devpost-thumbnail', 1200, 800],
    ['smartdetector-icon-1024', 1024, 1024],
  ]) {
    const source = await readFile(new URL(`docs/demo-assets/${name}.svg`, root), 'utf8');
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent('<html><body style="margin:0;background:white"><img alt="SmartDetector" style="display:block;width:100%;height:100%" src="data:image/svg+xml;base64,' + Buffer.from(source).toString('base64') + '"></body></html>');
    await page.locator('img').evaluate(img => img.decode());
    await page.screenshot({ path: fileURLToPath(new URL(`docs/demo-assets/${name}.png`, root)) });
    await page.close();
  }
} finally {
  await browser.close();
}
