import { chromium } from 'playwright';

async function checkLive() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ channel: 'msedge', headless: true }));
  const page = await browser.newPage();
  await page.goto('https://vvl-lorry-trip-manager.vercel.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const isLock = await page.locator('.pin-lock-card').isVisible();
  console.log('✓ Live Production Lock Screen Displayed:', isLock);
  
  await page.locator('.pin-key:has-text("2")').first().click();
  await page.locator('.pin-key:has-text("0")').first().click();
  await page.locator('.pin-key:has-text("2")').first().click();
  await page.locator('.pin-key:has-text("6")').first().click();
  await page.waitForTimeout(1200);

  const isUnlocked = await page.locator('.app-shell').isVisible();
  console.log('✓ Live Production Unlocked successfully with 2026:', isUnlocked);

  await browser.close();
}

checkLive();
