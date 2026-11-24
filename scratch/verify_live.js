const https = require('https');

https.get('https://vvl-lorry-trip-manager.vercel.app', (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    const match = html.match(/src="([^"]+index-[^"]+\.js)"/);
    if (!match) {
      console.log('Script tag not found');
      return;
    }
    const jsUrl = 'https://vvl-lorry-trip-manager.vercel.app' + match[1];
    console.log('Deployed JS bundle:', match[1]);
    https.get(jsUrl, (res2) => {
      let js = '';
      res2.on('data', chunk => js += chunk);
      res2.on('end', () => {
        console.log('✓ Has multiple balance receipts:', js.includes('balancePayments') || js.includes('Balance payment receipts'));
        console.log('✓ Has KM in diesel:', js.includes('KM (Odometer)'));
        console.log('✓ Has FASTag owner date range:', js.includes('FASTag description'));
        console.log('✓ Has Police case & RTO expense:', js.includes('policeRtoExpenses') || js.includes('Police case & RTO'));
        console.log('✓ Has PDF Still amount to pay to driver:', js.includes('STILL AMOUNT TO PAY TO DRIVER'));
        console.log('✓ Has PDF Excess advance with driver:', js.includes('EXCESS ADVANCE WITH DRIVER'));
        console.log('✓ Has Mileage calculation:', js.includes('Overall mileage'));
      });
    });
  });
});
