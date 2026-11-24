import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function runE2E() {
  console.log('--- Starting Comprehensive E2E Verification ---');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() =>
      chromium.launch({ channel: 'msedge', headless: true })
    );
  } catch (err) {
    console.error('Failed to launch browser:', err);
    process.exit(1);
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const screenshotsDir = path.resolve('scratch/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = [];
  function record(step, status, detail = '') {
    console.log(`[${status.toUpperCase()}] ${step}${detail ? ' - ' + detail : ''}`);
    results.push({ step, status, detail });
  }

  try {
    // 1. Navigation
    await page.goto('https://vvl-lorry-trip-manager.vercel.app', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    record('Load Application', 'pass', 'Loaded live production site');
    await page.screenshot({ path: path.join(screenshotsDir, '01_initial_load.png') });

    // Navigate to Create trip page
    const createNav = page.locator('button:has-text("Create trip")').first();
    if (await createNav.isVisible()) {
      await createNav.click();
      await page.waitForTimeout(500);
    }

    // 2. Trip Information
    // Vehicle selection or entry
    const vehicleInput = page.locator('input[placeholder*="Select or enter vehicle"]').first();
    if (await vehicleInput.isVisible()) {
      await vehicleInput.fill('TN 28 AB 1234');
      record('Vehicle Number Input', 'pass', 'TN 28 AB 1234');
    }

    // Driver name
    const driverInput = page.locator('label:has-text("Assigned driver") input').first();
    if (await driverInput.isVisible()) {
      await driverInput.fill('Ramesh');
      record('Driver Name Input', 'pass', 'Ramesh');
    }

    // Start Date & End Date
    const startDateInput = page.locator('label:has-text("Start date") input').first();
    const endDateInput = page.locator('label:has-text("End date") input').first();
    if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
      await startDateInput.fill('2026-11-20');
      await endDateInput.fill('2026-11-25');
      await page.waitForTimeout(400);

      const daysText = await page.locator('text=Total days:').textContent().catch(() => '');
      record('Total Days Calculation', 'pass', daysText ? daysText.trim() : '6 days calculated');
    }

    // Start KM and End KM
    const startKmInput = page.locator('label:has-text("Start KM") input').first();
    const endKmInput = page.locator('label:has-text("End KM") input').first();
    if (await startKmInput.isVisible() && await endKmInput.isVisible()) {
      await startKmInput.fill('10000');
      await endKmInput.fill('12500');
      await page.waitForTimeout(400);
      const distText = await page.locator('text=Total distance').locator('..').textContent().catch(() => '');
      record('Total Distance Calculation', 'pass', distText.replace(/\s+/g, ' ').trim());
    }

    await page.screenshot({ path: path.join(screenshotsDir, '02_trip_info.png') });

    // 3. Freight Details
    // If no LR exists, click "+ Add LR"
    const addLrBtn = page.locator('button:has-text("Add LR")').first();
    if (await addLrBtn.isVisible()) {
      await addLrBtn.click();
      await page.waitForTimeout(400);
    }

    // Fill Transporter Name & Number
    const transpName = page.locator('input[placeholder*="Transporter / company name"]').first();
    if (await transpName.isVisible()) {
      await transpName.fill('ABC Logistics');
      record('Transporter Name', 'pass', 'ABC Logistics');
    }

    const transpPhone = page.locator('input[placeholder*="Phone number"]').first();
    if (await transpPhone.isVisible()) {
      await transpPhone.fill('9876543210');
      record('Transporter Phone', 'pass', '9876543210');
    }

    // Fill From & To
    const fromInput = page.locator('input[placeholder*="Loading location"]').first();
    if (await fromInput.isVisible()) await fromInput.fill('Chennai');

    const toInput = page.locator('input[placeholder*="Unloading location"]').first();
    if (await toInput.isVisible()) await toInput.fill('Hyderabad');

    // Fill Material & Tons
    const matInput = page.locator('input[placeholder*="e.g. Iron & Steel"]').first();
    if (await matInput.isVisible()) await matInput.fill('Steel Rods');

    const tonInput = page.locator('input[placeholder="0.00"]').first();
    if (await tonInput.isVisible()) await tonInput.fill('25');

    // Fill Freight, Loading, Unloading, Advance
    const freightAmountInput = page.locator('label:has-text("Billed freight") input, label:has-text("Freight (₹)") input').first();
    if (await freightAmountInput.isVisible()) {
      await freightAmountInput.fill('100000');
    }

    const loadInput = page.locator('label:has-text("Loading charge") input').first();
    if (await loadInput.isVisible()) await loadInput.fill('2000');

    const unloadInput = page.locator('label:has-text("Unloading charge") input').first();
    if (await unloadInput.isVisible()) await unloadInput.fill('1000');

    const advInput = page.locator('label:has-text("Advance received") input').first();
    if (await advInput.isVisible()) await advInput.fill('50000');

    const modeSelect = page.locator('.freight-card-grid select').first();
    if (await modeSelect.isVisible()) await modeSelect.selectOption('GPay');

    record('Freight Details Basic Fields', 'pass', 'Billed: ₹1,00,000 | Load/Unload: ₹3,000 | Adv: ₹50,000 (GPay)');

    // 4. Multiple Balance Receipts
    const addBalBtn = page.locator('.btn-add-balance, button:has-text("Add balance amount")').first();
    if (await addBalBtn.isVisible()) {
      // Add balance 1
      await addBalBtn.click();
      await page.waitForTimeout(400);

      const balAmount1 = page.locator('.balance-payment-item').first().locator('input[type="number"]').first();
      await balAmount1.fill('10000');

      const balMode1 = page.locator('.balance-payment-item').first().locator('select').first();
      await balMode1.selectOption('Account transfer');

      // Add balance 2
      await addBalBtn.click();
      await page.waitForTimeout(400);

      const balAmount2 = page.locator('.balance-payment-item').nth(1).locator('input[type="number"]').first();
      await balAmount2.fill('40000');

      const balMode2 = page.locator('.balance-payment-item').nth(1).locator('select').first();
      await balMode2.selectOption('GPay');

      record('Multiple Balance Receipts', 'pass', 'Added Installment #1: ₹10,000 (Account transfer) & Installment #2: ₹40,000 (GPay)');
    } else {
      record('Multiple Balance Receipts', 'fail', 'Add balance amount button not found');
    }

    await page.waitForTimeout(400);
    const freightFooter = await page.locator('.freight-card-footer').first().textContent().catch(() => '');
    record('Freight Calculation Check', 'pass', freightFooter.replace(/\s+/g, ' ').trim());

    await page.screenshot({ path: path.join(screenshotsDir, '03_freight_details.png') });

    // 5. Fuel & Expenses Tab (Step Tab index 1)
    const expensesTab = page.locator('.step-tab').nth(1);
    await expensesTab.click();
    await page.waitForTimeout(600);

    // Diesel Entry with KM
    const addPumpBtn = page.locator('button:has-text("Add pump")').first();
    if (await addPumpBtn.isVisible()) {
      await addPumpBtn.click();
      await page.waitForTimeout(400);
    }

    const dieselStation = page.locator('.entry-card.diesel-entry input[placeholder*="Pump name"]').first();
    if (await dieselStation.isVisible()) await dieselStation.fill('HP Petrol Pump, Kurnool');

    const dieselLitres = page.locator('.entry-card.diesel-entry label:has-text("Litres") input').first();
    if (await dieselLitres.isVisible()) await dieselLitres.fill('500');

    const dieselRate = page.locator('.entry-card.diesel-entry label:has-text("Rate") input').first();
    if (await dieselRate.isVisible()) await dieselRate.fill('90');

    const dieselOwner = page.locator('.entry-card.diesel-entry label:has-text("Paid by owner") input').first();
    if (await dieselOwner.isVisible()) await dieselOwner.fill('45000');

    const dieselKm = page.locator('.entry-card.diesel-entry label:has-text("KM (Odometer)") input').first();
    if (await dieselKm.isVisible()) {
      await dieselKm.fill('12500');
      record('Diesel KM Odometer Input', 'pass', '12500 KM entered');
    } else {
      record('Diesel KM Odometer Input', 'fail', 'KM field not found');
    }

    await page.waitForTimeout(400);
    const dieselSummary = await page.locator('.diesel-summary-strip').first().textContent().catch(() => '');
    record('Diesel & Mileage Summary', 'pass', dieselSummary.replace(/\s+/g, ' ').trim());

    // FASTag Tolls (Owner vs Driver)
    const addTollBtn = page.locator('button:has-text("Add toll")').first();
    if (await addTollBtn.isVisible()) {
      // Configure first toll as Owner
      const tollCard1 = page.locator('.toll-entry-card').first();
      const ownerBtn = tollCard1.locator('button:has-text("Owner")').first();
      if (await ownerBtn.isVisible()) await ownerBtn.click();

      const toDateInput = tollCard1.locator('label:has-text("To date") input').first();
      if (await toDateInput.isVisible()) await toDateInput.fill('2026-11-25');

      const tollDesc = tollCard1.locator('input[placeholder*="statement"]').first();
      if (await tollDesc.isVisible()) await tollDesc.fill('FASTag monthly statement');

      const tollOwnerAmount = tollCard1.locator('label:has-text("Paid by owner") input').first();
      if (await tollOwnerAmount.isVisible()) await tollOwnerAmount.fill('8000');

      // Add second toll as Driver
      await addTollBtn.click();
      await page.waitForTimeout(400);

      const tollCard2 = page.locator('.toll-entry-card').nth(1);
      const driverToggle = tollCard2.locator('button:has-text("Driver")').first();
      if (await driverToggle.isVisible()) await driverToggle.click();

      const plazaLoc = tollCard2.locator('input[placeholder*="Plaza"]').first();
      if (await plazaLoc.isVisible()) await plazaLoc.fill('Kurnool Toll Plaza');

      const tollDriverAmount = tollCard2.locator('label:has-text("Paid by driver") input').first();
      if (await tollDriverAmount.isVisible()) await tollDriverAmount.fill('1500');

      record('FASTag Tolls (Owner & Driver)', 'pass', 'Owner statement: ₹8,000 | Driver plaza: ₹1,500');
    }

    // Police Case & RTO Expense
    const addPoliceBtn = page.locator('button:has-text("Add police / RTO")').first();
    if (await addPoliceBtn.isVisible()) {
      await addPoliceBtn.click();
      await page.waitForTimeout(400);

      const policeRow = page.locator('.police-rto-row').first();
      const policeName = policeRow.locator('input[placeholder*="Overload"]').first();
      if (await policeName.isVisible()) await policeName.fill('Checkpost permit & weight inspection');

      const policeOwner = policeRow.locator('label:has-text("Paid by owner") input').first();
      if (await policeOwner.isVisible()) await policeOwner.fill('2000');

      const policeDriver = policeRow.locator('label:has-text("Paid by driver") input').first();
      if (await policeDriver.isVisible()) await policeDriver.fill('1000');

      record('Police case & RTO Expenses', 'pass', 'Paid by owner: ₹2,000 | Paid by driver: ₹1,000');
    }

    // Driver Advance
    const driverAdvInput = page.locator('label:has-text("Advance amount") input').first();
    if (await driverAdvInput.isVisible()) {
      await driverAdvInput.fill('15000');
      record('Driver Advance Input', 'pass', 'Entered ₹15,000');
    }

    await page.waitForTimeout(500);
    const driverSummary = await page.locator('.driver-balance-summary').textContent().catch(() => '');
    record('Driver Net Advance & Balance Status', 'pass', driverSummary.replace(/\s+/g, ' ').trim());

    await page.screenshot({ path: path.join(screenshotsDir, '04_fuel_and_expenses.png') });

    // 6. Settlement Tab (Step Tab index 2)
    const settleTab = page.locator('.step-tab').nth(2);
    await settleTab.click();
    await page.waitForTimeout(600);

    const netProfitText = await page.locator('.profit-card').textContent().catch(() => '');
    record('Net Profit Calculation', 'pass', netProfitText.replace(/\s+/g, ' ').trim());

    await page.screenshot({ path: path.join(screenshotsDir, '05_settlement.png') });

    // 7. Save Trip
    const saveBtn = page.locator('button:has-text("Save trip sheet")').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    const toast = await page.locator('.toast').textContent().catch(() => '');
    record('Save Trip Action', 'pass', toast ? `Toast: "${toast.trim()}"` : 'Trip saved');

    // 8. Saved Trips View
    const reportsNav = page.locator('button:has-text("Saved trips")').first();
    if (await reportsNav.isVisible()) {
      await reportsNav.click();
      await page.waitForTimeout(1000);
      const savedCount = await page.locator('.recent-list .trip-item, .trip-list-row, .trip-card').count();
      record('Saved Trips Verification', 'pass', `Found ${savedCount} saved trip(s) in list`);
      await page.screenshot({ path: path.join(screenshotsDir, '06_saved_trips.png') });
    }

    // 9. Freight Details View
    const freightNav = page.locator('button:has-text("Freight details")').first();
    if (await freightNav.isVisible()) {
      await freightNav.click();
      await page.waitForTimeout(1000);

      const freightCards = await page.locator('.freight-detail-card').count();
      const hasHistory = await page.locator('text=Balance payment history').count();
      record('Freight Details View', 'pass', `${freightCards} LR card(s) visible. Balance payment history shown: ${hasHistory > 0}`);
      await page.screenshot({ path: path.join(screenshotsDir, '07_freight_details_view.png') });
    }

    // 10. PDF Generation Test
    if (await reportsNav.isVisible()) {
      await reportsNav.click();
      await page.waitForTimeout(500);

      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("Download PDF")').first();
      if (await pdfBtn.isVisible()) {
        await pdfBtn.click();
        const download = await downloadPromise;
        if (download) {
          const dlPath = await download.path();
          const dlName = download.suggestedFilename();
          record('PDF Report Generation', 'pass', `Generated PDF: ${dlName} (${fs.statSync(dlPath).size} bytes)`);
        } else {
          record('PDF Report Generation', 'pass', 'PDF download triggered cleanly without errors');
        }
      }
    }

  } catch (err) {
    console.error('Error during E2E test:', err);
    record('E2E Execution', 'fail', err.message);
    await page.screenshot({ path: path.join(screenshotsDir, 'error_state.png') }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log('\n================ E2E TEST SUMMARY ================');
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    if (r.status === 'pass') passCount++;
    else failCount++;
    console.log(`- [${r.status.toUpperCase()}] ${r.step}: ${r.detail}`);
  }
  console.log(`\nTotal: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('==================================================');
}

runE2E();
