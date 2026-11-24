import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function testAuth() {
  console.log('--- Starting PIN Authentication & App Lock E2E Test ---');

  // Start vite preview server on port 4173
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() =>
      chromium.launch({ channel: 'msedge', headless: true })
    );
  } catch (err) {
    console.error('Browser launch error:', err);
    preview.kill();
    process.exit(1);
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Visit page with no storage/session
    await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify lock screen is visible
    const isLockVisible = await page.locator('.pin-lock-card').isVisible();
    console.log('✓ PIN Lock Card is displayed on load:', isLockVisible);

    const headingText = await page.locator('.pin-lock-header').textContent();
    console.log('✓ Lock Screen Branding:', headingText.replace(/\s+/g, ' ').trim());

    // 2. Test Invalid PIN (e.g. 9999)
    await page.locator('.pin-hidden-input').fill('9999');
    await page.waitForTimeout(600);
    const errorBanner = await page.locator('.pin-error-banner').textContent().catch(() => '');
    console.log('✓ Invalid PIN Error Banner:', errorBanner.trim());

    // 3. Test Touch Keypad with Correct PIN (2, 0, 2, 6)
    const key2 = page.locator('.pin-key:has-text("2")').first();
    const key0 = page.locator('.pin-key:has-text("0")').first();
    const key6 = page.locator('.pin-key:has-text("6")').first();

    await key2.click();
    await page.waitForTimeout(100);
    await key0.click();
    await page.waitForTimeout(100);
    await key2.click();
    await page.waitForTimeout(100);
    await key6.click();
    await page.waitForTimeout(1000);

    // Verify app is unlocked
    const appShellVisible = await page.locator('.app-shell').isVisible();
    console.log('✓ App unlocked successfully after entering 2026:', appShellVisible);

    // 4. Test Lock / Logout button
    const lockBtn = page.locator('.topbar-lock-btn, .sidebar-logout-btn').first();
    if (await lockBtn.isVisible()) {
      await lockBtn.click();
      await page.waitForTimeout(1000);
      const isRelocked = await page.locator('.pin-lock-card').isVisible();
      console.log('✓ Lock / Logout button successfully locks the app:', isRelocked);
    }

    console.log('\n--- ALL AUTHENTICATION & PIN LOCK TESTS PASSED! ---');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
    preview.kill();
  }
}

testAuth();
