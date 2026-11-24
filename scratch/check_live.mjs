import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('https://vvl-lorry-trip-manager.vercel.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  
  const pinInput = page.locator('input[type="password"]');
  if (await pinInput.count() > 0) {
    console.log('Entering PIN 2026...');
    await pinInput.fill('2026');
    await page.waitForTimeout(2000);
  }

  // Navigate to Create trip
  const createTripBtn = page.locator('button:has-text("Create trip"), .sidebar-nav button:has-text("Create trip")').first();
  if (await createTripBtn.count() > 0) {
    await createTripBtn.click();
    await page.waitForTimeout(1000);
  }

  const originCard = await page.locator('.origin-card').count();
  const destCard = await page.locator('.dest-card').count();
  const startPlace = await page.locator('input[placeholder*="Salem"]').count();
  const endPlace = await page.locator('input[placeholder*="Chennai"]').count();

  console.log(`VERIFICATION RESULT ON LIVE PRODUCTION:`);
  console.log(`- Origin Card found: ${originCard > 0}`);
  console.log(`- Destination Card found: ${destCard > 0}`);
  console.log(`- Start Place input found: ${startPlace > 0}`);
  console.log(`- End Place input found: ${endPlace > 0}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
