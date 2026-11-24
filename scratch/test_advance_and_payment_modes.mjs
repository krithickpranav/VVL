import { chromium } from 'playwright';
import { createServer } from 'vite';

async function runTest() {
  console.log('--- STARTING FREIGHT ADVANCE SPLIT & PAYMENT MODES TEST ---');

  const server = await createServer({
    server: { port: 5199 },
  });
  await server.listen();
  const baseUrl = 'http://localhost:5199';

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 950 });

  const errors = [];
  page.on('pageerror', err => {
    console.error('Page error:', err);
    errors.push(err.message);
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Unlock PIN
    const pinInput = page.locator('.pin-hidden-input');
    if (await pinInput.count() > 0) {
      await page.click('.pin-key:has-text("2")');
      await page.click('.pin-key:has-text("0")');
      await page.click('.pin-key:has-text("2")');
      await page.click('.pin-key:has-text("6")');
      await page.waitForTimeout(1000);
    }

    // Go to Create trip
    await page.locator('.side-nav button:has-text("Create trip"), button:has-text("＋ Create trip")').first().click();
    await page.waitForTimeout(600);

    // Fill Trip Info
    await page.locator('input[placeholder*="Select or enter vehicle"]').fill('TN 88 B 1234');
    await page.locator('label:has-text("Assigned driver") input').fill('Kandasamy');
    await page.locator('input[placeholder*="Salem, Namakkal"]').fill('Namakkal Yard');
    await page.locator('input[placeholder*="Chennai, Bangalore"]').fill('Bangalore Peenya');
    await page.locator('label:has-text("Start KM") input').fill('10000');
    await page.locator('label:has-text("End KM") input').fill('11200'); // 1200 KM

    // Add Freight LR
    await page.locator('button:has-text("Add LR")').click();
    await page.waitForTimeout(400);

    await page.locator('label:has-text("Transporter name") input').last().fill('VRL Bangalore');
    await page.locator('label:has-text("From (Origin)") input').last().fill('Namakkal');
    await page.locator('label:has-text("To (Destination)") input').last().fill('Bangalore');
    await page.locator('label:has-text("Freight amount (₹)") input').last().fill('80000');

    // Enter Advance received by owner and driver
    console.log('Entering Advance received by Owner (₹20,000) and Driver (₹10,000)...');
    await page.locator('label:has-text("Advance received by owner (₹)") input').last().fill('20000');
    await page.locator('label:has-text("Advance received by driver (₹)") input').last().fill('10000');
    await page.waitForTimeout(300);

    // Verify auto-credit notice
    const autoCreditNotice = await page.locator('.lr-driver-adv-notice').innerText();
    console.log('Auto credit notice:', autoCreditNotice.trim());
    if (!autoCreditNotice.includes('10,000')) {
      throw new Error(`Auto credit notice not displaying 10,000! Text: ${autoCreditNotice}`);
    }

    // Add a balance payment
    await page.locator('button:has-text("Add balance amount")').last().click();
    await page.waitForTimeout(300);
    await page.locator('label:has-text("Balance amount (₹)") input').last().fill('30000');

    // Check freight summary strip:
    // Billed: 80,000 | Advance: 30,000 (Owner: 20,000 | Driver: 10,000) | Balance: 30,000 | Total rec: 60,000 | Pending: 20,000
    const freightStrip = await page.locator('.freight-summary-strip').innerText();
    console.log('Freight summary strip:\n', freightStrip);
    if (!freightStrip.includes('80,000') || !freightStrip.includes('30,000') || !freightStrip.includes('20,000')) {
      throw new Error(`Freight summary math incorrect!`);
    }

    // Move to Step 2: Fuel & Expenses
    await page.locator('button.step-tab:has-text("Fuel & expenses")').click();
    await page.waitForTimeout(600);

    // Check Driver Advance row
    console.log('Checking Driver advance row and payment mode...');
    const advRow = page.locator('.driver-advance-row').first();
    await advRow.locator('label:has-text("Advance amount (₹)") input').fill('15000');
    // Select payment mode
    await advRow.locator('select.field-select').selectOption('GPay');

    // Check Gross Driver Advance in Step 2:
    // Direct from owner: 15,000
    // Freight advance collected by driver: + 10,000
    // Total gross advance with driver: 25,000!
    const step2DriverCost = await page.locator('.panel:has-text("Driver costs")').innerText();
    console.log('Step 2 Driver costs section:\n', step2DriverCost);

    if (!step2DriverCost.includes('10,000') || !step2DriverCost.includes('25,000')) {
      throw new Error(`Gross driver advance mismatch! Expected 25,000 with 10,000 freight advance!`);
    }

    // Add Driver Balance payment
    console.log('Adding Driver Balance payment with payment mode...');
    await page.locator('.panel:has-text("Driver costs") button:has-text("Add payment")').last().click();
    await page.waitForTimeout(300);
    const balRow = page.locator('.panel:has-text("Driver costs") .driver-advance-row').last();
    await balRow.locator('label:has-text("Balance paid (₹)") input').fill('3000');
    await balRow.locator('select.field-select').selectOption('Cash');

    // Move to Step 3: Settlement
    await page.locator('button.step-tab:has-text("Settlement")').click();
    await page.waitForTimeout(600);

    const payableRowText = await page.locator('.payable-row').innerText();
    console.log('Settlement payable row text:\n', payableRowText);

    if (!payableRowText.includes('15,000') || !payableRowText.includes('10,000') || !payableRowText.includes('25,000') || !payableRowText.includes('3,000')) {
      throw new Error(`Settlement ledger mismatch! Text: ${payableRowText}`);
    }

    // Test Responsiveness at Mobile viewport (375x667)
    console.log('Testing mobile responsiveness (375px)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Mobile horizontal scroll overflow: ${hasHorizontalScroll}`);

    // Restore desktop viewport
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(500);

    // Save trip
    await page.locator('button.save-button:has-text("Save trip sheet")').click();
    await page.waitForTimeout(1000);

    // Export PDF
    await page.locator('.side-nav button:has-text("Saved trips")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("PDF"), button:has-text("Export PDF")').first().click();
    await page.waitForTimeout(1500);

    if (errors.length > 0) {
      throw new Error(`Console errors encountered: ${errors.join('; ')}`);
    }

    console.log('===========================================================');
    console.log('ALL ADVANCE SPLIT & PAYMENT MODE TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    await browser.close();
    await server.close();
  }
}

runTest().catch(err => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
