import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function runTest() {
  console.log('--- STARTING FREIGHT ADVANCE SPLIT & PAYMENT MODES TEST (PRODUCTION PREVIEW) ---');

  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], { shell: true });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const baseUrl = 'http://localhost:4173';

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

    await page.locator('label:has-text("Transporter name") input').last().fill('VRL Bangalore Logistics');
    await page.locator('label:has-text("From (Origin)") input').last().fill('Namakkal Yard');
    await page.locator('label:has-text("To (Destination)") input').last().fill('Bangalore Peenya Industrial Area');
    await page.locator('label:has-text("Material") input').last().fill('Automotive Spares');
    await page.locator('label:has-text("Weight (Tons)") input').last().fill('24.5');
    await page.locator('label:has-text("Freight amount (₹)") input').last().fill('100000');

    // Enter Advance received by owner and driver
    console.log('Entering Advance received by Owner (₹40,000) and Driver (₹10,000)...');
    await page.locator('label:has-text("Advance received by owner (₹)") input').last().fill('40000');
    await page.locator('label:has-text("Advance received by driver (₹)") input').last().fill('10000');
    await page.waitForTimeout(300);

    // Verify auto-credit notice
    const autoCreditNotice = await page.locator('.lr-driver-adv-notice').innerText();
    console.log('Auto credit notice:', autoCreditNotice.trim());
    if (!autoCreditNotice.includes('10,000')) {
      throw new Error(`Auto credit notice not displaying 10,000! Text: ${autoCreditNotice}`);
    }

    // Add multiple balance payments (2 installments)
    await page.locator('button:has-text("Add balance amount")').last().click();
    await page.waitForTimeout(300);
    await page.locator('label:has-text("Balance amount (₹)") input').first().fill('20000');
    await page.locator('.balance-payment-item').first().locator('label:has-text("Mode of payment") select').selectOption('Account transfer');

    await page.locator('button:has-text("Add balance amount")').last().click();
    await page.waitForTimeout(300);
    await page.locator('label:has-text("Balance amount (₹)") input').last().fill('30000');
    await page.locator('.balance-payment-item').last().locator('label:has-text("Mode of payment") select').selectOption('GPay');

    // Check freight summary strip:
    // Billed: 100,000 | Advance: 50,000 (Owner: 40,000 | Driver: 10,000) | Balance: 50,000 | Total rec: 100,000 | Pending: 0
    const freightStrip = await page.locator('.freight-summary-strip').innerText();
    console.log('Freight summary strip:\n', freightStrip);
    if (!freightStrip.includes('1,00,000') || !freightStrip.includes('50,000')) {
      throw new Error(`Freight summary math incorrect!`);
    }

    // Move to Step 2: Fuel & Expenses
    await page.locator('button.step-tab:has-text("Fuel & expenses")').click();
    await page.waitForTimeout(600);

    // Add Diesel entry with km, litres, paid by driver
    console.log('Adding Diesel entry...');
    await page.locator('button:has-text("Add pump")').click();
    await page.waitForTimeout(300);
    const dieselCard = page.locator('.diesel-entry').last();
    await dieselCard.locator('label:has-text("Station / location") input').fill('IOCL Namakkal');
    await dieselCard.locator('label:has-text("Litres") input').fill('150');
    await dieselCard.locator('label:has-text("KM (Odometer)") input').fill('10600');
    await dieselCard.locator('label:has-text("Paid by driver") input').fill('5000');
    await dieselCard.locator('label:has-text("Paid by owner") input').fill('9500');

    // Add FASTag toll
    console.log('Adding Toll entry...');
    await page.locator('button:has-text("Add toll log")').click();
    await page.waitForTimeout(300);
    const tollCard = page.locator('.toll-entry-card').last();
    await tollCard.locator('label.field-compact select').selectOption('driver');
    await page.waitForTimeout(200);
    await tollCard.locator('label:has-text("Plaza / location") input').fill('Krishnagiri Toll Plaza');
    await tollCard.locator('label:has-text("Paid by driver (₹)") input').fill('1200');

    // Add Loading / Unloading
    console.log('Adding Loading/Unloading entry...');
    await page.locator('button:has-text("Add loading / unloading")').click();
    await page.waitForTimeout(300);
    const loadRow = page.locator('.loading-expense-row').last();
    await loadRow.locator('label:has-text("Place name / Warehouse") input').fill('Bangalore Warehouse');
    await loadRow.locator('label:has-text("Paid by driver (₹)") input').fill('1500');

    // Add Police / RTO
    console.log('Adding Police/RTO entry...');
    await page.locator('button:has-text("Add police / RTO")').click();
    await page.waitForTimeout(300);
    const rtoRow = page.locator('.police-rto-row').last();
    await rtoRow.locator('label:has-text("Expense name / Reason") input').fill('Attibele Checkpost Permit');
    await rtoRow.locator('label:has-text("Paid by driver (₹)") input').fill('800');

    // Add Bill Expense
    console.log('Adding Bill expense...');
    await page.locator('.repeatable-heading:has-text("Tyre puncture") button:has-text("Add entry")').click();
    await page.waitForTimeout(300);
    const billRow = page.locator('.vehicle-expense-row').last();
    await billRow.locator('label:has-text("Expense type") select').selectOption('Other');
    await billRow.locator('label:has-text("Expense name") input').fill('Tyre puncture & grease');
    await billRow.locator('label:has-text("Paid by driver (₹)") input').fill('500');

    // Add Other Expense
    console.log('Adding Other expense...');
    await page.locator('.repeatable-heading:has-text("Other expense entries") button:has-text("Add entry")').click();
    await page.waitForTimeout(300);
    const otherRow = page.locator('.other-expense-row').last();
    await otherRow.locator('label:has-text("Expense name") input').fill('Driver food & tea');
    await otherRow.locator('label:has-text("Paid by driver (₹)") input').fill('1000');

    // Driver Advance row
    console.log('Checking Driver advance row and payment mode...');
    const advBlock = page.locator('.repeatable-block:has-text("Driver advance payments")');
    const advRow = advBlock.locator('.driver-advance-row').first();
    await advRow.locator('label:has-text("Advance amount (₹)") input').fill('15000');
    await advRow.locator('select.field-select').selectOption('GPay');

    const step2DriverCost = await page.locator('.panel:has-text("Driver costs")').innerText();
    console.log('Step 2 Driver costs section:\n', step2DriverCost);

    // Verify Driver Gross Advance:
    // Direct from owner: 15,000
    // Freight advance collected by driver: + 10,000
    // Total gross advance with driver: 25,000!
    if (!step2DriverCost.includes('10,000') || !step2DriverCost.includes('25,000')) {
      throw new Error(`Gross driver advance mismatch! Expected 25,000 with 10,000 freight advance!`);
    }

    // Add Driver Balance payment
    console.log('Adding Driver Balance payment with payment mode...');
    const balBlock = page.locator('.repeatable-block:has-text("Driver balance payments")');
    await balBlock.locator('button:has-text("Add payment")').last().click();
    await page.waitForTimeout(300);
    const balRow = balBlock.locator('.driver-advance-row').last();
    await balRow.locator('label:has-text("Balance paid (₹)") input').fill('3000');
    await balRow.locator('select.field-select').selectOption('Cash');

    // Add Amount sent by driver to owner (₹8,000) to settle remaining excess advance
    console.log('Adding Amount sent by driver to owner (₹8,000)...');
    const retBlock = page.locator('.repeatable-block:has-text("Amount sent by driver to owner")');
    await retBlock.locator('button:has-text("Add payment")').last().click();
    await page.waitForTimeout(300);
    const retRow = retBlock.locator('.driver-advance-row').last();
    await retRow.locator('label:has-text("Amount sent to owner (₹)") input').fill('8000');
    await retRow.locator('select.field-select').selectOption('GPay');

    // Move to Step 3: Settlement
    await page.locator('button.step-tab:has-text("Settlement")').click();
    await page.waitForTimeout(600);

    // Driver Bata / Commission % on Settlement tab
    await page.locator('label:has-text("Commission (%)") input').fill('10'); // 10% of 100,000 = 10,000
    await page.waitForTimeout(300);

    const payableRowText = await page.locator('.payable-row').innerText();
    console.log('Settlement payable row text:\n', payableRowText);
    if (!payableRowText.includes('8,000') || !payableRowText.includes('Fully settled')) {
      throw new Error(`Driver return to owner settlement mismatch! Text: ${payableRowText}`);
    }

    // Test Responsiveness at Mobile viewport (375x667)
    console.log('Testing mobile responsiveness (375px)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Mobile horizontal scroll overflow at 375px: ${hasHorizontalScroll}`);

    // Restore desktop viewport
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.waitForTimeout(500);

    // Save trip
    await page.locator('button.save-button:has-text("Save trip sheet")').click();
    await page.waitForTimeout(1000);

    // Export PDF
    console.log('Testing PDF Export...');
    await page.locator('.side-nav button:has-text("Saved trips")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("PDF"), button:has-text("Export PDF")').first().click();
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      throw new Error(`Console errors encountered: ${errors.join('; ')}`);
    }

    console.log('===========================================================');
    console.log('ALL ADVANCE SPLIT & PAYMENT MODE TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    await browser.close();
    server.kill();
  }
}

runTest().catch(err => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
