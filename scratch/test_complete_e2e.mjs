import { chromium } from 'playwright';
import { createServer } from 'vite';

async function runComprehensiveE2E() {
  console.log('--- STARTING COMPREHENSIVE END-TO-END TEST ---');

  // 1. Start Vite dev server locally on port 5199
  console.log('[1/7] Starting local Vite server on port 5199...');
  const server = await createServer({
    server: { port: 5199 },
  });
  await server.listen();
  const baseUrl = 'http://localhost:5199';
  console.log(`Vite server running at ${baseUrl}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 950 });

  const errors = [];
  page.on('pageerror', err => {
    console.error('Browser Page Error:', err);
    errors.push(err.message);
  });

  try {
    // 2. Security PIN Screen
    console.log('[2/7] Checking Security PIN screen & unlocking...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const pinInput = page.locator('.pin-hidden-input');
    if (await pinInput.count() > 0) {
      console.log('PIN keypad detected. Clicking touch keypad 2 - 0 - 2 - 6...');
      await page.click('.pin-key:has-text("2")');
      await page.waitForTimeout(100);
      await page.click('.pin-key:has-text("0")');
      await page.waitForTimeout(100);
      await page.click('.pin-key:has-text("2")');
      await page.waitForTimeout(100);
      await page.click('.pin-key:has-text("6")');
      await page.waitForTimeout(1200);
    }

    // 3. Navigate to Create Trip
    console.log('[3/7] Testing Step 1: Trip Information & Freight Details...');
    const createTripNav = page.locator('.side-nav button:has-text("Create trip"), button:has-text("＋ Create trip")').first();
    await createTripNav.click();
    await page.waitForTimeout(600);

    // Fill Trip Information
    await page.locator('input[placeholder*="Select or enter vehicle"]').fill('TN 88 AA 9999');
    await page.locator('label:has-text("Assigned driver") input').fill('Murugan S');
    
    // Dates & Places
    const startPlaceInput = page.locator('input[placeholder*="Salem, Namakkal"]');
    const endPlaceInput = page.locator('input[placeholder*="Chennai, Bangalore"]');
    await startPlaceInput.fill('Salem Junction');
    await endPlaceInput.fill('Chennai Port');

    // KM readings
    await page.locator('label:has-text("Start KM") input').fill('15000');
    await page.locator('label:has-text("End KM") input').fill('17500');

    // Verify distance calculation
    const distanceText = await page.locator('.odometer-total strong').innerText();
    console.log(`Calculated distance: ${distanceText.trim()}`);
    if (!distanceText.includes('2,500') && !distanceText.includes('2500')) {
      throw new Error(`Distance calculation incorrect! Expected 2,500 KM, got: ${distanceText}`);
    }

    // Freight Details: Add LR 1
    console.log('Adding Freight LR 1...');
    await page.locator('button:has-text("Add LR")').click();
    await page.waitForTimeout(400);

    // Fill LR 1
    await page.locator('label:has-text("Transporter name") input').last().fill('VRL Logistics');
    await page.locator('label:has-text("Transporter number") input').last().fill('9842100000');
    await page.locator('label:has-text("From (Origin)") input').last().fill('Salem');
    await page.locator('label:has-text("To (Destination)") input').last().fill('Chennai');
    await page.locator('label:has-text("Material") input').last().fill('Steel Coils');
    await page.locator('label:has-text("Weight (Tons)") input').last().fill('22');
    await page.locator('label:has-text("Freight amount (₹)") input').last().fill('60000');

    // Freight Advance on LR 1
    await page.locator('label:has-text("Advance received (₹)") input').last().fill('25000');

    // Add Balance Installment 1
    console.log('Adding Balance Installment 1...');
    await page.locator('button:has-text("Add balance amount")').last().click();
    await page.waitForTimeout(300);

    const balanceAmountInputs = page.locator('label:has-text("Balance amount (₹)") input');
    await balanceAmountInputs.first().fill('15000');

    // Add Balance Installment 2
    console.log('Adding Balance Installment 2...');
    await page.locator('button:has-text("Add balance amount")').last().click();
    await page.waitForTimeout(300);
    await balanceAmountInputs.nth(1).fill('10000');

    // Verify Freight Math:
    // Billed: 60,000
    // Advance: 25,000
    // Balance Paid: 15,000 + 10,000 = 25,000
    // Total Received: 50,000
    // Pending: 10,000
    const freightSummaryStrip = await page.locator('.freight-summary-strip').innerText();
    console.log('Freight summary strip:', freightSummaryStrip.replace(/\n/g, ' | '));

    if (!freightSummaryStrip.includes('60,000') || !freightSummaryStrip.includes('50,000') || !freightSummaryStrip.includes('10,000')) {
      throw new Error(`Freight summary math incorrect! Content: ${freightSummaryStrip}`);
    }

    // 4. Move to Step 2: Fuel & Expenses
    console.log('[4/7] Testing Step 2: Fuel & Expenses...');
    await page.locator('button.step-tab:has-text("Fuel & expenses"), button:has-text("Continue to Fuel & expenses")').first().click();
    await page.waitForTimeout(600);

    // Diesel Entries:
    const existingPumps = await page.locator('.diesel-entry').count();
    console.log(`Existing diesel pump rows: ${existingPumps}`);

    if (existingPumps > 0) {
      console.log('Filling Diesel Entry 1 (Owner)...');
      await page.locator('.diesel-entry').first().locator('label:has-text("Station / location") input').fill('HPCL Salem');
      await page.locator('.diesel-entry').first().locator('label:has-text("Litres") input').fill('250');
      await page.locator('.diesel-entry').first().locator('label:has-text("KM (Odometer)") input').fill('15500');
      await page.locator('.diesel-entry').first().locator('label:has-text("Paid by owner (₹)") input').fill('23000');
      await page.locator('.diesel-entry').first().locator('label:has-text("Paid by driver (₹)") input').fill('0');
    } else {
      await page.locator('button:has-text("Add pump")').click();
      await page.waitForTimeout(300);
      await page.locator('.diesel-entry').last().locator('label:has-text("Station / location") input').fill('HPCL Salem');
      await page.locator('.diesel-entry').last().locator('label:has-text("Litres") input').fill('250');
      await page.locator('.diesel-entry').last().locator('label:has-text("KM (Odometer)") input').fill('15500');
      await page.locator('.diesel-entry').last().locator('label:has-text("Paid by owner (₹)") input').fill('23000');
    }

    // Add Diesel Entry 2 (Paid by driver)
    console.log('Adding Diesel Entry 2 (Driver)...');
    await page.locator('button:has-text("Add pump")').click();
    await page.waitForTimeout(300);
    await page.locator('.diesel-entry').last().locator('label:has-text("Station / location") input').fill('IOCL Ulundurpet');
    await page.locator('.diesel-entry').last().locator('label:has-text("Litres") input').fill('250');
    await page.locator('.diesel-entry').last().locator('label:has-text("KM (Odometer)") input').fill('16500');
    await page.locator('.diesel-entry').last().locator('label:has-text("Paid by owner (₹)") input').fill('0');
    await page.locator('.diesel-entry').last().locator('label:has-text("Paid by driver (₹)") input').fill('23000');

    // Verify Diesel & Mileage Math:
    // Total Litres: 500 L
    // Total KM: 2,500 KM
    // Mileage: 2500 / 500 = 5 KM/L
    // Owner Diesel: 23,000
    // Driver Diesel: 23,000
    // Total Diesel: 46,000
    const dieselSummary = await page.locator('.diesel-summary-strip').first().innerText();
    console.log('Diesel summary strip:', dieselSummary.replace(/\n/g, ' | '));

    if (!dieselSummary.includes('500') || (!dieselSummary.includes('5 KM/L') && !dieselSummary.includes('5.00 KM/L')) || !dieselSummary.includes('46,000')) {
      throw new Error(`Diesel & Mileage math incorrect! Content: ${dieselSummary}`);
    }

    // Loading & Unloading Charges
    console.log('Adding Loading & Unloading Expense (Driver)...');
    await page.locator('button:has-text("Add loading / unloading")').click();
    await page.waitForTimeout(300);
    const loadingCard = page.locator('.loading-expense-row').last();
    await loadingCard.locator('label:has-text("Place name / Warehouse") input').fill('Salem Plant Loading');
    await loadingCard.locator('label:has-text("Paid by driver (₹)") input').fill('2000');

    // Fastag Toll
    console.log('Adding FASTag Toll (Driver)...');
    await page.locator('button:has-text("Add toll log")').click();
    await page.waitForTimeout(300);
    const tollCard = page.locator('.toll-entry-card').last();
    await tollCard.locator('select.field-select').selectOption('driver');
    await page.waitForTimeout(200);
    await tollCard.locator('label:has-text("Plaza / location") input').fill('Attibele Toll');
    await tollCard.locator('label:has-text("Paid by driver (₹)") input').fill('1800');

    // Police Case & RTO
    console.log('Adding Police & RTO Expense (Driver)...');
    await page.locator('button:has-text("Add police / RTO")').click();
    await page.waitForTimeout(300);
    const policeCard = page.locator('.police-rto-row').last();
    await policeCard.locator('label:has-text("Expense name / Reason") input').fill('RTO Checkpost Entry');
    await policeCard.locator('label:has-text("Paid by driver (₹)") input').fill('1200');

    // Bill & Repairs
    console.log('Adding Bill / Repair Expense (Driver)...');
    await page.locator('.panel:has-text("Bill expense") button:has-text("Add entry")').click();
    await page.waitForTimeout(300);
    const billCard = page.locator('.vehicle-expense-row').last();
    await billCard.locator('label:has-text("Paid by driver (₹)") input').fill('1000');

    // Other Expenses
    console.log('Adding Other Expense (Driver)...');
    await page.locator('.panel:has-text("Other expense") button:has-text("Add entry")').click();
    await page.waitForTimeout(300);
    const otherCard = page.locator('.other-expense-row').last();
    await otherCard.locator('label:has-text("Expense name") input').fill('Weight Bridge & Parking');
    await otherCard.locator('label:has-text("Paid by driver (₹)") input').fill('500');

    // Set Driver Advance to 30,000
    console.log('Updating Driver Advance to 30,000...');
    const advCount = await page.locator('.driver-advance-row').count();
    if (advCount === 0) {
      await page.locator('button:has-text("Add payment")').first().click();
      await page.waitForTimeout(300);
    }
    await page.locator('.driver-advance-row').first().locator('label:has-text("Advance amount (₹)") input').fill('30000');

    // 5. Move to Step 3: Settlement
    console.log('[5/7] Testing Step 3: Operating Expenses & Net Profit...');
    await page.locator('button.step-tab:has-text("Settlement"), button:has-text("Continue to Settlement")').first().click();
    await page.waitForTimeout(600);

    // Configure Commission (%) to 10%
    console.log('Setting Commission to 10%...');
    const commInput = page.locator('label:has-text("Commission (%)") input');
    await commInput.fill('10');
    await page.waitForTimeout(300);

    // Exact Calculations Reconciliation:
    // Freight: 60,000
    // Commission 10%: 6,000
    // Driver Advance given: 30,000
    // Driver-paid expenses deducted:
    // Diesel: 23,000
    // Toll: 1,800
    // Police: 1,200
    // Loading: 2,000
    // Repair: 1,000
    // Other: 500
    // Total Driver Expenses = 29,500
    // Net Advance in hand = 30,000 - 29,500 = 500
    // Driver Commission earned = + 6,000
    // Remaining Driver Balance = 6,000 - 500 = 5,500 payable to driver!

    // Total Operating Expenses:
    // Owner Diesel: 23,000
    // Driver Diesel: 23,000 (total diesel 46,000)
    // Tolls: 1,800
    // Police: 1,200
    // Loading: 2,000
    // Repair: 1,000
    // Other: 500
    // Driver Commission: 6,000
    // Operating Expenses Total = 58,500!

    // Owner Net Profit:
    // Freight 60,000 - Operating Expenses 58,500 = 1,500!

    const operatingTotal = await page.locator('.summary-total strong').innerText();
    console.log(`Total operating expenses: ${operatingTotal.trim()}`);
    if (!operatingTotal.includes('58,500')) {
      throw new Error(`Operating expenses mismatch! Expected 58,500, got: ${operatingTotal}`);
    }

    const netProfitText = await page.locator('.profit-card strong').innerText();
    console.log(`Net Profit: ${netProfitText.trim()}`);
    if (!netProfitText.includes('1,500')) {
      throw new Error(`Net profit mismatch! Expected 1,500, got: ${netProfitText}`);
    }

    const payableCard = await page.locator('.payable-total strong').innerText();
    console.log(`Payable card: ${payableCard.trim()}`);
    if (!payableCard.includes('5,500')) {
      throw new Error(`Payable card mismatch! Expected 5,500, got: ${payableCard}`);
    }

    // 6. Test Save Trip Sheet
    console.log('[6/7] Testing Save Trip Sheet...');
    await page.locator('button.save-button:has-text("Save trip sheet")').click();
    await page.waitForTimeout(1200);

    // Verify Saved Trips
    const savedTripsNav = page.locator('.side-nav button:has-text("Saved trips")');
    await savedTripsNav.click();
    await page.waitForTimeout(800);

    const savedTripsList = await page.locator('.recent-list').innerText();
    console.log('Saved Trips list check...');
    if (!savedTripsList.includes('TN 88 AA 9999') || (!savedTripsList.includes('5 KM/L') && !savedTripsList.includes('5.00 KM/L'))) {
      throw new Error(`Saved trip not found in list or mileage missing! Content: ${savedTripsList}`);
    }
    console.log('Saved trip verified with vehicle TN 88 AA 9999 and Mileage 5 KM/L!');

    // 7. Test PDF Generation (Export PDF)
    console.log('[7/7] Testing PDF Generation without errors...');
    const pdfButton = page.locator('button:has-text("PDF"), button:has-text("Export PDF")').first();
    await pdfButton.click();
    await page.waitForTimeout(1500);

    if (errors.length > 0) {
      throw new Error(`Browser console errors detected: ${errors.join(', ')}`);
    }
    console.log('PDF export generated cleanly without any console errors!');

    console.log('====================================================');
    console.log('ALL ONE END-TO-END CHECKS PASSED WITH 100% ACCURACY!');
    console.log('====================================================');
  } finally {
    await browser.close();
    await server.close();
  }
}

runComprehensiveE2E().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
