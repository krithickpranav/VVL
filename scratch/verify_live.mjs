const res = await fetch('https://vvl-lorry-trip-manager.vercel.app');
const html = await res.text();
const match = html.match(/src="([^"]+index-[^"]+\.js)"/);
if (!match) {
  console.log('Script tag not found');
} else {
  console.log('Deployed JS bundle:', match[1]);
  const jsRes = await fetch('https://vvl-lorry-trip-manager.vercel.app' + match[1]);
  const js = await jsRes.text();
  console.log('✓ Has multiple balance receipts:', js.includes('balancePayments') || js.includes('Balance payment receipts'));
  console.log('✓ Has KM in diesel:', js.includes('KM (Odometer)'));
  console.log('✓ Has FASTag owner date range:', js.includes('FASTag description'));
  console.log('✓ Has Police case & RTO expense:', js.includes('policeRtoExpenses') || js.includes('Police case & RTO'));
  console.log('✓ Has PDF Still amount to pay to driver:', js.includes('STILL AMOUNT TO PAY TO DRIVER'));
  console.log('✓ Has PDF Excess advance with driver:', js.includes('EXCESS ADVANCE WITH DRIVER'));
  console.log('✓ Has Mileage calculation:', js.includes('Overall mileage'));
}
