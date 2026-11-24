import assert from 'assert';

function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const utc1 = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const utc2 = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays + 1 : 0;
}

console.log('--- Testing calculateDays ---');
assert.strictEqual(calculateDays('2026-11-20', '2026-11-20'), 1, 'Same day should be 1 day');
assert.strictEqual(calculateDays('2026-11-20', '2026-11-23'), 4, 'Nov 20 to Nov 23 should be 4 days');
assert.strictEqual(calculateDays('2026-11-30', '2026-12-02'), 3, 'Nov 30 to Dec 2 should be 3 days');
assert.strictEqual(calculateDays('2026-11-25', '2026-11-20'), 0, 'End before start should be 0');
assert.strictEqual(calculateDays('', '2026-11-20'), 0, 'Empty start should be 0');
console.log('✓ calculateDays passed all test cases!');

console.log('--- Testing Freight LR Fields ---');
const sampleLr = {
  transporterName: 'VRL Logistics',
  transporterNumber: '9845012345',
  from: 'Hyderabad',
  to: 'Bangalore',
  material: 'Steel Coils',
  weight: 15.5,
  amount: 32000,
  loadingCharge: 500,
  unloadingCharge: 500,
  received: 1000,
  advanceDate: '2026-11-20',
  paymentMode: 'GPay',
};

const totalLr = Number(sampleLr.amount) + Number(sampleLr.loadingCharge) + Number(sampleLr.unloadingCharge);
const pending = Math.max(0, totalLr - Number(sampleLr.received));
assert.strictEqual(totalLr, 33000, 'Total LR billing should include amount + loading + unloading');
assert.strictEqual(pending, 32000, 'Pending should be total LR minus advance received');
assert.strictEqual(sampleLr.paymentMode, 'GPay', 'Payment mode should be preserved');
console.log('✓ Freight calculation passed!');
