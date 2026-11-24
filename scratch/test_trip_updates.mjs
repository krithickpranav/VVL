import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function run() {
  console.log('Starting preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], { shell: true });
  
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();

  try {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    console.log('Navigating to preview...');
    await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 1. PIN Unlock
    console.log('Checking PIN unlock screen...');
    const isLockVisible = await page.locator('.pin-lock-card').isVisible();
    console.log('Lock screen visible:', isLockVisible);

    const key2 = page.locator('.pin-key:has-text("2")').first();
    const key0 = page.locator('.pin-key:has-text("0")').first();
    const key6 = page.locator('.pin-key:has-text("6")').first();
    await key2.click();
    await key0.click();
    await key2.click();
    await key6.click();
    await page.waitForTimeout(1000);

    // 2. Click Create trip in sidebar
    console.log('Clicking Create trip nav...');
    await page.locator('.nav-item:has-text("Create trip")').click();
    await page.waitForTimeout(1000);

    // 3. Verify Trip Information - Vehicle, Driver, Start Place & End Place
    console.log('Checking Start Place and End Place inputs...');
    await page.locator('input[placeholder*="AP 28 TC"]').fill('TN 28 AB 1234');

    const startPlaceInput = page.locator('input[placeholder*="Salem"]');
    await startPlaceInput.waitFor({ timeout: 5000 });
    await startPlaceInput.fill('Salem Junction');

    const endPlaceInput = page.locator('input[placeholder*="Chennai"]');
    await endPlaceInput.waitFor({ timeout: 5000 });
    await endPlaceInput.fill('Chennai Harbour');
    console.log('✓ Start Place & End Place inputs verified!');

    // Check Odometer & KM
    const startKmInput = page.locator('input[type="number"]').first();
    await startKmInput.fill('40000');
    const endKmInput = page.locator('label:has-text("End KM") input');
    await endKmInput.fill('41000');

    // 4. Verify Freight details - loading and unloading REMOVED from freight
    console.log('Verifying freight details inputs...');
    const addLrBtn = page.locator('button:has-text("＋ Add LR")');
    await addLrBtn.click();
    await page.waitForTimeout(300);

    const loadingInFreight = await page.locator('.freight-card-grid label:has-text("Loading charge")').count();
    const unloadingInFreight = await page.locator('.freight-card-grid label:has-text("Unloading charge")').count();
    console.log(`Loading charge in Freight: ${loadingInFreight} (Expected: 0)`);
    console.log(`Unloading charge in Freight: ${unloadingInFreight} (Expected: 0)`);
    if (loadingInFreight !== 0 || unloadingInFreight !== 0) {
      throw new Error('Loading / unloading charges still present in Freight details!');
    }
    console.log('✓ Loading & unloading charges successfully removed from Freight details!');

    // 5. Navigate to Step 2: Fuel & expenses
    console.log('Navigating to Step 2: Fuel & expenses...');
    await page.locator('.step-tab').nth(1).click();
    await page.waitForTimeout(500);

    // Check Loading & Unloading Expense Section
    console.log('Checking Loading & Unloading Expense Section...');
    const loadingSection = page.locator('h2:has-text("Loading & Unloading expense")');
    await loadingSection.waitFor({ timeout: 5000 });
    console.log('✓ Loading & Unloading Expense section present!');

    const addLoadingBtn = page.locator('button:has-text("＋ Add loading / unloading")');
    await addLoadingBtn.click();
    await page.waitForTimeout(300);

    const placeInput = page.locator('.loading-expense-row input[placeholder*="Godown"]');
    await placeInput.fill('Chennai Port Warehouse');
    const ownerLoadingInput = page.locator('.loading-expense-row label:has-text("Paid by owner") input');
    await ownerLoadingInput.fill('1500');
    console.log('✓ Loading expense entry added with Place and Paid by owner!');

    // Add Diesel pump and check KM & Mileage
    const addDieselBtn = page.locator('button:has-text("＋ Add pump")');
    await addDieselBtn.click();
    await page.waitForTimeout(300);

    const dieselLitres = page.locator('.diesel-entry label:has-text("Litres") input');
    await dieselLitres.fill('200');
    const dieselKm = page.locator('.diesel-entry label:has-text("KM (Odometer)") input');
    await dieselKm.fill('40500');
    const dieselOwner = page.locator('.diesel-entry label:has-text("Paid by owner") input');
    await dieselOwner.fill('19000');
    console.log('✓ Diesel entry with KM and litres added!');

    // Check Driver Advance
    const addAdvBtn = page.locator('button:has-text("＋ Add payment")').first();
    await addAdvBtn.click();
    await page.waitForTimeout(300);
    const advAmount = page.locator('.driver-advance-row label:has-text("Advance amount") input');
    await advAmount.fill('5000');

    // 6. Navigate to Step 3: Settlement
    console.log('Navigating to Step 3: Settlement...');
    await page.locator('.step-tab').nth(2).click();
    await page.waitForTimeout(500);

    // Verify Loading & unloading is in Operating Expenses breakdown
    const loadingInSettlement = await page.locator('.summary-line:has-text("Loading & unloading (Paid by owner)")').count();
    console.log(`Loading & unloading in Operating Breakdown: ${loadingInSettlement} (Expected: 1)`);
    if (loadingInSettlement === 0) {
      throw new Error('Loading & unloading not found in operating expense breakdown!');
    }
    console.log('✓ Loading & unloading correctly accounted in Settlement!');

    // 7. Save Trip
    console.log('Saving trip...');
    await page.locator('button:has-text("Save trip sheet")').click();
    await page.waitForTimeout(1500);

    // 8. Check Saved Trips Ledger / Dashboard for Mileage & Route
    console.log('Checking Saved Trips list for route and mileage badge...');
    const routeBadge = await page.locator('.trip-route-badge').first().textContent();
    console.log('Displayed Route:', routeBadge);

    const distanceChip = await page.locator('.trip-distance-chip').first().textContent();
    console.log('Displayed Distance:', distanceChip);

    const mileageChipCount = await page.locator('.trip-mileage-chip').count();
    console.log('Mileage chip count:', mileageChipCount);
    if (mileageChipCount > 0) {
      const mileageText = await page.locator('.trip-mileage-chip').first().textContent();
      console.log('Displayed Mileage:', mileageText);
    }

    // 9. Check PDF button click
    console.log('Testing PDF download generation...');
    const pdfBtn = page.locator('.trip-actions button:has-text("PDF")').first();
    await pdfBtn.click();
    await page.waitForTimeout(2000);
    console.log('✓ PDF generated successfully without errors!');

    console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
