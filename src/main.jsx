import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot } from './firebase';

const STORAGE_KEY = 'logistics-trip-reports-v2';
const SETTINGS_KEY = 'logistics-trip-settings-v1';
const LEGACY_STORAGE_KEY = 'logistics-trip-reports-v1';
const AUTH_SESSION_KEY = 'vvl_auth_unlocked_session_v1';
const AUTH_LOCAL_KEY = 'vvl_auth_unlocked_local_v1';
const DEFAULT_SETTINGS = {
  transporter: 'VETRI VELAVAN LOGISTICS',
  tagline: 'DELIVERING SUCCESS, EVERY MILE',
  groupName: 'SRI BALAJI TRANSPORTS',
  location: 'SALEM.10',
  phone: '9791404012',
  proprietor: 'SELVAMANIYAN DEVENDRA BABU',
  qualifications: 'B.E-MECH, MBA - Logistics and Supply Chain Management',
  vehicles: [],
  appPin: '2026',
};
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const amount = (value) => currency.format(Number(value) || 0);
const number = (value) => Number(value) || 0;
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const today = new Date().toISOString().slice(0, 10);
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getNextTripNumber(existingTrips = [], dateStr = today) {
  let monthStr = 'NOV';
  let yearStr = '26';

  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const yearNum = parseInt(parts[0], 10);
      const monthNum = parseInt(parts[1], 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        monthStr = MONTH_NAMES[monthNum - 1];
      }
      if (!isNaN(yearNum)) {
        yearStr = String(yearNum).slice(-2);
      }
    }
  }

  // Matches NOV 26-001, NOV26-001, NOV 26-002, etc.
  const regex = new RegExp(`^${monthStr}\\s*${yearStr}[\\s-]*(\\d+)`, 'i');
  let maxSeq = 0;
  let useSpace = true;

  for (const t of (existingTrips || [])) {
    const raw = String(t.tripNumber || '').trim();
    const match = raw.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
      if (/^[A-Za-z]{3}\d{2}/.test(raw)) {
        useSpace = false;
      } else if (/^[A-Za-z]{3}\\s+\\d{2}/.test(raw)) {
        useSpace = true;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return useSpace ? `${monthStr} ${yearStr}-${nextSeq}` : `${monthStr}${yearStr}-${nextSeq}`;
}

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

function freshTrip(existingTrips = [], dateStr = today) {
  const nextNumber = getNextTripNumber(existingTrips, dateStr);
  const isFirstEver = (!existingTrips || existingTrips.length === 0);

  if (isFirstEver) {
    return {
      tripNumber: nextNumber,
      truck: '',
      driver: 'Rajesh Kumar',
      startDate: dateStr || today,
      startPlace: 'Salem',
      endDate: dateStr || today,
      endPlace: 'Chennai',
      startKm: 45210,
      endKm: 46120,
      freights: [
        {
          id: makeId(),
          transporterName: 'VRL Logistics',
          transporterNumber: '9845012345',
          from: 'Hyderabad',
          to: 'Bangalore',
          material: 'Steel Coils',
          weight: 15.5,
          amount: 32000,
          received: 1000,
          advanceDate: dateStr || today,
          paymentMode: 'GPay',
          balancePayments: [],
        },
        {
          id: makeId(),
          transporterName: 'Sri Murugan Transports',
          transporterNumber: '9443212345',
          from: 'Bangalore',
          to: 'Chennai',
          material: 'General Cargo',
          weight: 12,
          amount: 24000,
          received: 800,
          advanceDate: dateStr || today,
          paymentMode: 'Cash to driver',
          balancePayments: [],
        },
      ],
      diesel: [{ id: makeId(), station: 'HP Petrol Pump, Kurnool', date: dateStr || today, litres: 180, km: 45600, paidByOwner: 17100, paidByDriver: '', amount: 17100 }],
      expenses: {
        loadingUnloadingExpenses: [
          { id: makeId(), date: dateStr || today, type: 'Loading charge', place: 'Hyderabad Godown', paidByOwner: 900, paidByDriver: '', amount: 900 },
          { id: makeId(), date: dateStr || today, type: 'Unloading charge', place: 'Bangalore Warehouse', paidByOwner: 900, paidByDriver: '', amount: 900 },
        ],
        otherExpenses: [
          { id: makeId(), date: dateStr || today, name: 'Food & meals', paidByOwner: 1500, paidByDriver: '', amount: 1500 },
          { id: makeId(), date: dateStr || today, name: 'Misc. & phone', paidByOwner: 500, paidByDriver: '', amount: 500 },
          { id: makeId(), date: dateStr || today, name: 'Kurnool Checkpost', paidByOwner: 1200, paidByDriver: '', amount: 1200 },
        ],
        tolls: [{ id: makeId(), date: dateStr || today, toDate: '', location: 'Orvakal Toll Plaza', paidBy: 'owner', paidByOwner: 1850, paidByDriver: '', amount: 1850 }],
        vehicleExpenses: [],
        policeRtoExpenses: [],
        driverAdvances: [{ id: makeId(), date: dateStr || today, amount: 5000 }],
        driverBalancePayments: [],
        driverBataPct: 0,
        commissionPct: 15,
      },
    };
  }

  return {
    tripNumber: nextNumber,
    truck: '',
    driver: '',
    startDate: dateStr || today,
    startPlace: '',
    endDate: dateStr || today,
    endPlace: '',
    startKm: '',
    endKm: '',
    freights: [],
    diesel: [],
    expenses: {
      loadingUnloadingExpenses: [],
      otherExpenses: [],
      tolls: [],
      vehicleExpenses: [],
      policeRtoExpenses: [],
      driverAdvances: [],
      driverBalancePayments: [],
      driverBataPct: 0,
      commissionPct: 15,
    },
  };
}

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    return fallback;
  }
}

function loadSettings() {
  const stored = readStorage(SETTINGS_KEY, {});
  const saved = stored && typeof stored === 'object' ? stored : {};
  const transporter = saved.transporter === 'Sri Lakshminarayana Logistics'
    ? DEFAULT_SETTINGS.transporter
    : saved.transporter || DEFAULT_SETTINGS.transporter;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    transporter,
    vehicles: Array.isArray(saved.vehicles) ? saved.vehicles : [],
    appPin: saved.appPin || DEFAULT_SETTINGS.appPin,
  };
}

// Cache the logo data URL in memory — only fetched once per session
let _logoDataUrlCache = null;
async function loadLogoDataUrl() {
  if (_logoDataUrlCache) return _logoDataUrlCache;
  const response = await fetch(`${import.meta.env.BASE_URL}vetri-velavan-logo.jpeg`);
  if (!response.ok) throw new Error('Unable to load the company logo for the PDF.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  _logoDataUrlCache = `data:image/jpeg;base64,${btoa(binary)}`;
  return _logoDataUrlCache;
}

function loadTrips() {
  const current = readStorage(STORAGE_KEY, null);
  if (Array.isArray(current)) return current.map(normalizeTrip);
  const legacy = readStorage(LEGACY_STORAGE_KEY, []);
  if (!Array.isArray(legacy)) return [];
  return legacy.map(normalizeTrip);
}

function normalizeTrip(trip) {
  const expenses = trip.expenses || {};
  const freights = (Array.isArray(trip.freights) ? trip.freights : [])
    .map((row) => ({
      ...row,
      id: row.id || makeId(),
      transporterName: row.transporterName || '',
      transporterNumber: row.transporterNumber || '',
      loadingCharge: row.loadingCharge ?? '',
      unloadingCharge: row.unloadingCharge ?? '',
      received: row.received ?? row.advanceReceived ?? '',
      advanceDate: row.advanceDate || row.date || trip.startDate || today,
      paymentMode: row.paymentMode || 'GPay',
      balancePayments: (Array.isArray(row.balancePayments) ? row.balancePayments : [])
        .map((b) => ({
          id: b.id || makeId(),
          date: b.date || today,
          amount: b.amount ?? '',
          paymentMode: b.paymentMode || 'Account transfer',
        })),
    }));
  const hasLoadingExpenses = Array.isArray(expenses.loadingUnloadingExpenses) && expenses.loadingUnloadingExpenses.length > 0;
  const freightTotal = freights.reduce((sum, item) => sum + number(item.amount) + (hasLoadingExpenses ? 0 : (number(item.loadingCharge) + number(item.unloadingCharge))), 0);
  const vehicleExpenses = Array.isArray(expenses.vehicleExpenses)
    ? expenses.vehicleExpenses.map((row) => {
      const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
      const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
      const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
      const paidByDriver = hasDriver ? row.paidByDriver : '';
      return {
        ...row,
        id: row.id || makeId(),
        date: row.date || trip.startDate || today,
        type: row.type === 'AdBlue refilling' ? 'AdBlue oil refill' : row.type || 'Other',
        paidByOwner,
        paidByDriver,
      };
    })
    : number(expenses.maintenance) ? [{
      id: makeId(), date: trip.startDate || today, type: 'Other', name: 'Maintenance & repair',
      amount: expenses.maintenance, paidByOwner: expenses.maintenance, paidByDriver: '', litres: '', rate: '',
    }] : [];
  const policeRtoExpenses = Array.isArray(expenses.policeRtoExpenses)
    ? expenses.policeRtoExpenses.map((row) => {
      const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
      const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
      const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
      const paidByDriver = hasDriver ? row.paidByDriver : '';
      return {
        ...row,
        id: row.id || makeId(),
        date: row.date || trip.startDate || today,
        name: row.name || 'Police & RTO expense',
        paidByOwner,
        paidByDriver,
        amount: (number(paidByOwner) + number(paidByDriver)) || row.amount || '',
      };
    })
    : (Array.isArray(expenses.checkpoints) ? expenses.checkpoints.map((row) => ({
      id: makeId(),
      date: row.date || trip.startDate || today,
      name: row.location || 'RTO & police checkpoint',
      paidByOwner: row.amount || '',
      paidByDriver: '',
      amount: row.amount || '',
    })) : (number(expenses.rto) ? [{
      id: makeId(), date: trip.startDate || today, name: 'RTO & police checkpoints', paidByOwner: expenses.rto, paidByDriver: '', amount: expenses.rto,
    }] : []));
  const loadingUnloadingExpenses = Array.isArray(expenses.loadingUnloadingExpenses)
    ? expenses.loadingUnloadingExpenses.map((row) => {
      const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
      const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
      const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
      const paidByDriver = hasDriver ? row.paidByDriver : '';
      return {
        ...row,
        id: row.id || makeId(),
        date: row.date || trip.startDate || today,
        type: row.type || 'Loading charge',
        place: row.place || '',
        paidByOwner,
        paidByDriver,
        amount: (number(paidByOwner) + number(paidByDriver)) || row.amount || '',
      };
    })
    : [];
  const otherExpenses = Array.isArray(expenses.otherExpenses)
    ? expenses.otherExpenses.map((row) => {
      const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
      const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
      const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
      const paidByDriver = hasDriver ? row.paidByDriver : '';
      return { ...row, id: row.id || makeId(), date: row.date || trip.startDate || today, paidByOwner, paidByDriver };
    })
    : [
      ['Food & meals', expenses.food],
      ['Loading / coolie', expenses.lock],
      ['Misc. & phone', expenses.misc],
    ].filter(([, value]) => number(value) !== 0).map(([name, value, date]) => ({
      id: makeId(), date: date || trip.startDate || today, name, amount: value,
    }));
  const driverAdvances = Array.isArray(expenses.driverAdvances)
    ? expenses.driverAdvances.map((row) => ({ ...row, id: row.id || makeId(), date: row.date || trip.startDate || today }))
    : number(expenses.driverAdvance) ? [{
      id: makeId(), date: trip.startDate || today, amount: expenses.driverAdvance,
    }] : [];
  const driverBalancePayments = Array.isArray(expenses.driverBalancePayments)
    ? expenses.driverBalancePayments.map((row) => ({ ...row, id: row.id || makeId(), date: row.date || trip.startDate || today }))
    : [];

  return {
    ...trip,
    startPlace: trip.startPlace || '',
    endPlace: trip.endPlace || '',
    freights,
    diesel: (Array.isArray(trip.diesel) ? trip.diesel : []).map((row) => {
      const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
      const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
      let paidByOwner = hasOwner ? row.paidByOwner : '';
      let paidByDriver = hasDriver ? row.paidByDriver : '';
      if (!hasOwner && !hasDriver && row.amount !== undefined) {
        if (row.paidBy === 'driver') {
          paidByDriver = row.amount;
          paidByOwner = '';
        } else {
          paidByOwner = row.amount;
          paidByDriver = '';
        }
      }
      const totalAmount = number(paidByOwner) + number(paidByDriver);
      return {
        ...row,
        id: row.id || makeId(),
        date: row.date || trip.startDate || today,
        station: row.station || '',
        litres: row.litres ?? '',
        km: row.km ?? '',
        paidByOwner,
        paidByDriver,
        amount: totalAmount || row.amount || '',
      };
    }),
    expenses: {
      ...expenses,
      driverBataPct: expenses.driverBataPct !== undefined
        ? expenses.driverBataPct
        : freightTotal > 0 ? number(expenses.driverBata) / freightTotal * 100 : 0,
      loadingUnloadingExpenses,
      vehicleExpenses,
      policeRtoExpenses,
      otherExpenses,
      driverAdvances,
      driverBalancePayments,
      tolls: Array.isArray(expenses.tolls)
        ? expenses.tolls.map((row) => {
          const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
          const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
          const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
          const paidByDriver = hasDriver ? row.paidByDriver : '';
          return {
            ...row,
            id: row.id || makeId(),
            date: row.date || trip.startDate || today,
            toDate: row.toDate || '',
            location: row.location || 'FASTag tolls',
            paidBy: row.paidBy || (hasDriver && !hasOwner ? 'driver' : 'owner'),
            paidByOwner,
            paidByDriver,
            amount: (number(paidByOwner) + number(paidByDriver)) || row.amount || '',
          };
        })
        : [{
          id: makeId(), date: trip.startDate || today, toDate: '', location: 'FASTag tolls', paidBy: 'owner', amount: number(expenses.tolls), paidByOwner: number(expenses.tolls), paidByDriver: '',
        }],
    },
  };
}

function calculate(trip) {
  const expenses = trip.expenses || {};
  const freightAmount = (trip.freights || []).reduce((sum, item) => sum + number(item.amount), 0);
  const legacyLoading = (trip.freights || []).reduce((sum, item) => sum + number(item.loadingCharge) + number(item.unloadingCharge), 0);
  const freight = freightAmount + (expenses.loadingUnloadingExpenses?.length ? 0 : legacyLoading);

  // Advance received
  const advanceReceived = (trip.freights || []).reduce((sum, item) => sum + number(item.received), 0);
  // Balance payments received (multiple installments per LR)
  const balanceReceived = (trip.freights || []).reduce((sum, item) =>
    sum + (item.balancePayments || []).reduce((bSum, b) => bSum + number(b.amount), 0), 0);
  const received = advanceReceived + balanceReceived;
  const pending = Math.max(0, freight - received);

  // Diesel
  const dieselOwner = (trip.diesel || []).reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidBy === 'driver') return sum;
    return sum + number(item.amount);
  }, 0);

  const dieselDriver = (trip.diesel || []).reduce((sum, item) => {
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum + number(item.paidByDriver);
    if (item.paidBy === 'driver') return sum + number(item.amount);
    return sum;
  }, 0);

  const dieselTotal = dieselOwner + dieselDriver;
  const totalLitres = (trip.diesel || []).reduce((sum, item) => sum + number(item.litres), 0);
  const totalKm = Math.max(0, number(trip.endKm) - number(trip.startKm));
  const mileage = totalLitres > 0 && totalKm > 0 ? Number((totalKm / totalLitres).toFixed(2)) : 0;

  // Tolls
  const tollsOwner = (expenses.tolls || []).reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + number(item.amount);
  }, 0);
  const tollsDriver = (expenses.tolls || []).reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const tolls = tollsOwner + tollsDriver;

  // Police & RTO Expenses
  const policeOwner = (expenses.policeRtoExpenses || []).reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + number(item.amount);
  }, 0);
  const policeDriver = (expenses.policeRtoExpenses || []).reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const policeRto = policeOwner + policeDriver;

  // Loading & Unloading Expenses
  const loadingOwner = (expenses.loadingUnloadingExpenses || []).reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + number(item.amount);
  }, 0);
  const loadingDriver = (expenses.loadingUnloadingExpenses || []).reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const loadingUnloadingTotal = loadingOwner + loadingDriver;

  // Other Expenses
  const otherOwner = (expenses.otherExpenses || []).reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + number(item.amount);
  }, 0);
  const otherDriver = (expenses.otherExpenses || []).reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const otherExpenses = otherOwner + otherDriver;

  // Vehicle / Bill Expenses
  const vehicleOwner = (expenses.vehicleExpenses || []).reduce((sum, item) => {
    const base = item.type === 'AdBlue oil refill' ? number(item.litres) * number(item.rate) : number(item.amount);
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + base;
  }, 0);
  const vehicleDriver = (expenses.vehicleExpenses || []).reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const vehicleExpenses = vehicleOwner + vehicleDriver;

  // Driver calculations
  const grossDriverAdvance = (expenses.driverAdvances || []).reduce((sum, item) => sum + number(item.amount), 0);
  // All driver-paid expenses are subtracted from driver advance
  const totalDriverExpenses = dieselDriver + tollsDriver + policeDriver + loadingDriver + otherDriver + vehicleDriver;
  const driverAdvance = grossDriverAdvance - totalDriverExpenses;

  const driverBalancePaid = (expenses.driverBalancePayments || []).reduce((sum, item) => sum + number(item.amount), 0);
  const driverBata = freight * number(expenses.driverBataPct) / 100;

  // Owner-paid portions are operating expenses; driver-paid portions reduce driver advance
  const operatingExpenses = dieselOwner + otherOwner + tollsOwner + policeOwner + loadingOwner + vehicleOwner + driverBata;
  const commission = freight * number(expenses.commissionPct) / 100;
  const netProfit = freight - operatingExpenses;
  const finalPayable = (commission || 0) - driverAdvance - driverBalancePaid;

  return {
    freightAmount,
    freight,
    advanceReceived,
    balanceReceived,
    received,
    pending,
    diesel: dieselOwner,
    dieselOwner,
    dieselDriver,
    dieselTotal,
    totalLitres,
    totalKm,
    mileage,
    tolls,
    tollsOwner,
    tollsDriver,
    policeRto,
    policeOwner,
    policeDriver,
    loadingOwner,
    loadingDriver,
    loadingUnloadingTotal,
    otherExpenses,
    otherOwner,
    otherDriver,
    vehicleExpenses,
    vehicleOwner,
    vehicleDriver,
    grossDriverAdvance,
    totalDriverExpenses,
    driverAdvance,
    driverBalancePaid,
    driverBata,
    driverBataPct: number(expenses.driverBataPct),
    operatingExpenses,
    netProfit,
    commission,
    finalPayable,
  };
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

function Button({ children, variant = 'secondary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

function Field({ label, value, onChange, type = 'text', min, step, placeholder, className = '', required = false, ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(type === 'number' ? event.target.value : event.target.value)}
        min={min}
        step={step}
        placeholder={placeholder}
        required={required}
        {...props}
      />
    </label>
  );
}

function SectionTitle({ icon, children, action }) {
  return (
    <div className="section-title">
      <h2><Icon>{icon}</Icon>{children}</h2>
      {action}
    </div>
  );
}

function PinLockScreen({ correctPin, onUnlock, transporter, toast }) {
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleDigit = (digit) => {
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      setError('');
      if (next.length === (correctPin || '2026').length) {
        verifyPin(next);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const verifyPin = (candidatePin) => {
    const pinToTest = candidatePin !== undefined ? candidatePin : pin;
    if (pinToTest === (correctPin || '2026')) {
      onUnlock(remember);
    } else {
      setError('Incorrect Security PIN. Please try again.');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
      }, 500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      verifyPin();
    }
  };

  const targetLength = Math.max(4, (correctPin || '2026').length);

  return (
    <div className="pin-lock-wrapper">
      <div className={`pin-lock-card ${shake ? 'shake-anim' : ''}`}>
        <div className="pin-lock-header">
          <img
            className="pin-lock-logo"
            src={`${import.meta.env.BASE_URL}vetri-velavan-logo.jpeg`}
            alt="Vetri Velavan Logistics"
          />
          <h2>{transporter || 'VETRI VELAVAN LOGISTICS'}</h2>
          <span>TRANSPORT ACCOUNTS PORTAL</span>
        </div>

        <div className="pin-lock-body">
          <div className="pin-lock-icon">🔒</div>
          <h3>Secure Workspace Access</h3>
          <p>Enter your Security PIN to unlock trip sheets & accounts.</p>

          <div className="pin-dots-container" onClick={() => inputRef.current?.focus()}>
            {Array.from({ length: targetLength }).map((_, i) => (
              <span
                key={i}
                className={`pin-dot ${i < pin.length ? 'filled' : ''} ${error ? 'error' : ''}`}
              />
            ))}
          </div>

          <input
            ref={inputRef}
            className="pin-hidden-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPin(val);
              setError('');
              if (val.length === (correctPin || '2026').length) {
                verifyPin(val);
              }
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            aria-label="Security PIN"
          />

          {error && <div className="pin-error-banner">{error}</div>}

          {/* On-screen touch keypad for mobile phones, tablets & desktop */}
          <div className="pin-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="pin-key"
                onClick={() => handleDigit(String(num))}
              >
                {num}
              </button>
            ))}
            <button type="button" className="pin-key pin-key-func" onClick={handleClear}>
              C
            </button>
            <button
              type="button"
              className="pin-key"
              onClick={() => handleDigit('0')}
            >
              0
            </button>
            <button
              type="button"
              className="pin-key pin-key-func"
              onClick={handleBackspace}
              aria-label="Backspace"
            >
              ⌫
            </button>
          </div>

          <div className="pin-remember-row">
            <label className="pin-checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember this device</span>
            </label>
          </div>

          <button
            type="button"
            className="button button-primary pin-unlock-btn"
            onClick={() => verifyPin()}
          >
            Unlock Workspace →
          </button>

          <div className="pin-default-hint">
            <span>🔑 Default Security PIN: <strong>2026</strong></span>
            <small>Can be changed anytime in Settings</small>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [trips, setTrips] = useState(loadTrips);
  const [trip, setTrip] = useState(() => freshTrip(loadTrips()));
  const [page, setPage] = useState('create');
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('connecting'); // 'connecting' | 'synced' | 'syncing' | 'offline'
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true' || localStorage.getItem(AUTH_LOCAL_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const lockApp = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_LOCAL_KEY);
    } catch {}
    setIsUnlocked(false);
    setToast('Workspace locked.');
  }, []);

  // Firestore: Realtime sync for Settings
  useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = onSnapshot(doc(db, 'settings', 'profile'), (snapshot) => {
        if (snapshot.exists()) {
          const remoteSettings = snapshot.data();
          setSettings((local) => {
            const mergedVehicles = Array.from(new Set([
              ...(Array.isArray(local.vehicles) ? local.vehicles : []),
              ...(Array.isArray(remoteSettings.vehicles) ? remoteSettings.vehicles : []),
            ])).filter(Boolean);

            return {
              ...DEFAULT_SETTINGS,
              ...local,
              ...remoteSettings,
              vehicles: mergedVehicles,
            };
          });
        } else {
          // Initialize remote settings if not yet present in cloud
          const local = loadSettings();
          setDoc(doc(db, 'settings', 'profile'), local).catch(() => {});
        }
      }, (err) => {
        console.warn('Settings cloud sync note:', err.message);
      });
    } catch (e) {
      console.warn('Firebase init note:', e);
    }
    return () => unsubscribe && unsubscribe();
  }, []);

  // Firestore: Realtime bidirectional sync for Trips
  useEffect(() => {
    let unsubscribe;
    let initialSyncDone = false;
    try {
      unsubscribe = onSnapshot(collection(db, 'trips'), (snapshot) => {
        setCloudStatus('synced');
        const remoteTrips = snapshot.docs.map((docSnap) => normalizeTrip(docSnap.data()));

        if (!initialSyncDone && remoteTrips.length === 0) {
          initialSyncDone = true;
          // Initial migration only if Firestore is completely empty
          const local = loadTrips();
          if (local.length > 0) {
            setCloudStatus('syncing');
            Promise.all(local.map((t) => setDoc(doc(db, 'trips', t.id), t)))
              .then(() => setCloudStatus('synced'))
              .catch(() => setCloudStatus('synced'));
            return;
          }
        }

        initialSyncDone = true;
        // Firestore is the source of truth: deletions, additions, edits reflect cleanly
        setTrips(remoteTrips);

        // Update create form trip number if it's currently on default
        setTrip((cur) => {
          if (!editingId && (!cur.tripNumber || cur.tripNumber === getNextTripNumber([], cur.startDate))) {
            return { ...cur, tripNumber: getNextTripNumber(remoteTrips, cur.startDate) };
          }
          return cur;
        });
      }, (err) => {
        console.warn('Trips cloud sync note:', err.message);
        setCloudStatus('offline');
      });
    } catch (e) {
      console.warn('Firebase trips listener note:', e);
      setCloudStatus('offline');
    }
    return () => unsubscribe && unsubscribe();
  }, [editingId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      setStorageError('');
    } catch (error) {
      console.error('Unable to save trip reports to local storage.', error);
      setStorageError('Your browser could not save changes. Check available storage and try again.');
    }
  }, [trips]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Unable to save settings to local storage.', error);
      setStorageError('Your browser could not save settings. Check available storage and try again.');
    }
    // Sync settings to Firestore
    try {
      setDoc(doc(db, 'settings', 'profile'), settings).catch(() => {});
    } catch (e) {}
  }, [settings]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const totals = useMemo(() => calculate(trip), [trip]);

  const updateTrip = useCallback((key, value) => setTrip((current) => ({ ...current, [key]: value })), []);
  const updateExpense = useCallback((key, value) => setTrip((current) => ({
    ...current,
    expenses: { ...current.expenses, [key]: value },
  })), []);

  const updateRow = useCallback((group, id, key, value) => {
    if (group === 'freights' || group === 'diesel') {
      setTrip((current) => ({
        ...current,
        [group]: current[group].map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row, [key]: value };
          if (group === 'diesel') {
            const owner = key === 'paidByOwner' ? value : updated.paidByOwner;
            const driver = key === 'paidByDriver' ? value : updated.paidByDriver;
            updated.amount = (number(owner) + number(driver)) || '';
          }
          return updated;
        }),
      }));
      return;
    }
    setTrip((current) => ({
      ...current,
      expenses: {
        ...current.expenses,
        [group]: current.expenses[group].map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row, [key]: value };
          if (['tolls', 'otherExpenses', 'vehicleExpenses', 'policeRtoExpenses'].includes(group)) {
            const o = key === 'paidByOwner' ? value : updated.paidByOwner;
            const d = key === 'paidByDriver' ? value : updated.paidByDriver;
            if (o !== undefined || d !== undefined) {
              updated.amount = (number(o) + number(d)) || '';
            }
          }
          return updated;
        }),
      },
    }));
  }, []);

  const addFreightBalance = useCallback((freightId) => {
    setTrip((current) => ({
      ...current,
      freights: current.freights.map((f) => {
        if (f.id !== freightId) return f;
        const newBalance = { id: makeId(), date: today, amount: '', paymentMode: 'Account transfer' };
        return { ...f, balancePayments: [...(f.balancePayments || []), newBalance] };
      }),
    }));
  }, []);

  const updateFreightBalance = useCallback((freightId, balanceId, key, value) => {
    setTrip((current) => ({
      ...current,
      freights: current.freights.map((f) => {
        if (f.id !== freightId) return f;
        return {
          ...f,
          balancePayments: (f.balancePayments || []).map((b) => (b.id === balanceId ? { ...b, [key]: value } : b)),
        };
      }),
    }));
  }, []);

  const removeFreightBalance = useCallback((freightId, balanceId) => {
    setTrip((current) => ({
      ...current,
      freights: current.freights.map((f) => {
        if (f.id !== freightId) return f;
        return {
          ...f,
          balancePayments: (f.balancePayments || []).filter((b) => b.id !== balanceId),
        };
      }),
    }));
  }, []);

  const addRow = useCallback((group) => {
    const blank = {
      id: makeId(),
      ...(group === 'freights'
        ? {
            from: '',
            to: '',
            material: '',
            weight: '',
            transporterName: '',
            transporterNumber: '',
            amount: '',
            received: '',
            advanceDate: today,
            paymentMode: 'GPay',
            balancePayments: [],
          }
        : group === 'loadingUnloadingExpenses'
          ? { date: today, type: 'Loading charge', place: '', paidByOwner: '', paidByDriver: '', amount: '' }
        : group === 'vehicleExpenses'
          ? { date: today, type: 'Tyre puncture', name: '', paidByOwner: '', paidByDriver: '', amount: '', litres: '', rate: '' }
          : group === 'policeRtoExpenses'
            ? { date: today, name: '', paidByOwner: '', paidByDriver: '', amount: '' }
          : group === 'otherExpenses'
            ? { date: today, name: '', paidByOwner: '', paidByDriver: '', amount: '' }
          : group === 'driverAdvances'
            ? { date: today, amount: '' }
          : group === 'driverBalancePayments'
            ? { date: today, amount: '' }
          : group === 'tolls'
            ? { date: today, toDate: '', location: '', paidBy: 'owner', paidByOwner: '', paidByDriver: '', amount: '' }
            : { date: today, location: '', paidByOwner: '', paidByDriver: '', amount: '' }),
    };
    if (group === 'diesel') Object.assign(blank, { station: '', litres: '', km: '', paidByOwner: '', paidByDriver: '', amount: '' });
    if (group === 'freights' || group === 'diesel') {
      setTrip((current) => ({ ...current, [group]: [...current[group], blank] }));
    } else {
      setTrip((current) => ({
        ...current,
        expenses: { ...current.expenses, [group]: [...current.expenses[group], blank] },
      }));
    }
  }, []);

  const removeRow = useCallback((group, id) => {
    if (group === 'freights' || group === 'diesel') {
      setTrip((current) => ({ ...current, [group]: current[group].filter((row) => row.id !== id) }));
    } else {
      setTrip((current) => ({
        ...current,
        expenses: { ...current.expenses, [group]: current.expenses[group].filter((row) => row.id !== id) },
      }));
    }
  }, []);

  const navigate = useCallback((nextPage) => {
    setPage(nextPage);
    if (nextPage === 'create' && !editingId) {
      setTrip(freshTrip(trips));
      setStep(0);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [editingId, trips]);

  const saveTrip = useCallback((event) => {
    event.preventDefault();
    if (!String(trip.truck || '').trim()) {
      setStep(0);
      setToast('Select a vehicle number before saving the trip sheet.');
      return;
    }
    const now = new Date().toISOString();
    const saved = {
      ...trip,
      id: editingId || makeId(),
      transporter: settings.transporter,
      savedAt: editingId ? trips.find((item) => item.id === editingId)?.savedAt || now : now,
      updatedAt: now,
      totals,
    };
    const updatedTrips = editingId
      ? trips.map((item) => item.id === editingId ? saved : item)
      : [saved, ...trips];
    setTrips(updatedTrips);
    setEditingId(null);
    setPage('reports');
    setToast(`${saved.tripNumber || 'Trip'} saved & backed up to cloud.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Prime the create form with the next trip number for the month
    setTrip(freshTrip(updatedTrips));

    // Auto-save vehicle to fleet if it's new
    if (saved.truck && !settings.vehicles.includes(saved.truck)) {
      const updatedVehicles = Array.from(new Set([...(settings.vehicles || []), saved.truck]));
      const updatedSettings = { ...settings, vehicles: updatedVehicles };
      setSettings(updatedSettings);
      setDoc(doc(db, 'settings', 'profile'), updatedSettings).catch(() => {});
    }

    // Cloud Firestore Sync
    setCloudStatus('syncing');
    setDoc(doc(db, 'trips', saved.id), saved)
      .then(() => setCloudStatus('synced'))
      .catch((err) => {
        console.warn('Cloud sync save warning:', err);
        setCloudStatus('offline');
      });
  }, [trip, editingId, settings, trips, totals]);

  const editTrip = useCallback((saved) => {
    const normalized = normalizeTrip(saved);
    setTrip({
      ...freshTrip(),
      ...normalized,
      expenses: { ...freshTrip().expenses, ...(normalized.expenses || {}) },
    });
    setEditingId(saved.id);
    setPage('create');
    setStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteTrip = useCallback(async (id) => {
    const selected = trips.find((item) => item.id === id);
    if (!selected || !window.confirm(`Delete trip ${selected.tripNumber || ''}? This cannot be undone.`)) return;

    // Immediately update local state
    setTrips((current) => current.filter((item) => item.id !== id));
    setToast('Trip deleted.');

    // Cloud Firestore Delete
    try {
      setCloudStatus('syncing');
      await deleteDoc(doc(db, 'trips', id));
      setCloudStatus('synced');
    } catch (err) {
      console.warn('Cloud delete error:', err);
      setCloudStatus('offline');
    }
  }, [trips]);
  const downloadPdf = useCallback(async (savedTrip) => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setToast('Generating PDF…');
    try {
      const { jsPDF } = await import('jspdf');
      const logoData = await loadLogoDataUrl();
      const reportTotals = calculate(savedTrip);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const left = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const printableWidth = pageWidth - left * 2;
      const inr = (value) => `INR ${number(value).toLocaleString('en-IN')}`;

      const heading = () => {
        doc.addImage(logoData, 'JPEG', left, 7, 36, 18);
        doc.setTextColor(20, 33, 54);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(settings.transporter || DEFAULT_SETTINGS.transporter, left + 40, 11);
        doc.setFontSize(6.5);
        doc.setTextColor(102, 115, 135);
        doc.text(settings.tagline || DEFAULT_SETTINGS.tagline, left + 40, 15);
        doc.text(`A Group of ${settings.groupName || DEFAULT_SETTINGS.groupName}`, left + 40, 18.5);
        doc.text(`${settings.location || DEFAULT_SETTINGS.location} | Phone: ${settings.phone || DEFAULT_SETTINGS.phone}`, left + 40, 22);
        doc.text(`Proprietor: ${settings.proprietor || DEFAULT_SETTINGS.proprietor}`, left + 40, 25.5);
        doc.setFontSize(7.2);
        doc.setTextColor(30, 64, 175);
        doc.text('LORRY TRIP SHEET & SETTLEMENT STATEMENT', left + 40, 30);
        doc.setFontSize(10.5);
        doc.setTextColor(20, 33, 54);
        doc.text(savedTrip.tripNumber || 'Trip Sheet', pageWidth - left, 30, { align: 'right' });
        doc.setDrawColor(218, 225, 235);
        doc.line(left, 33, pageWidth - left, 33);
      };

      heading();
      let y = 37;

      const checkPageBreak = (neededHeight) => {
        if (y + neededHeight > 275) {
          doc.addPage();
          heading();
          y = 39;
        }
      };

      // 1. Executive Performance Cards (3 Cards across the page)
      const tripDays = calculateDays(savedTrip.startDate, savedTrip.endDate);
      const cardW = (printableWidth - 6) / 3;
      const cardH = 17;

      // Card 1: Vehicle & Driver
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(left, y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('VEHICLE & DRIVER', left + 3, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text(savedTrip.truck || 'Vehicle not specified', left + 3, y + 8.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`Driver: ${savedTrip.driver || 'Not assigned'}`, left + 3, y + 13.5);

      // Card 2: Route & Timeline
      const c2x = left + cardW + 3;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(c2x, y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('ROUTE & TIMELINE', c2x + 3, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      const routeStr = `${savedTrip.startPlace || 'Origin'} -> ${savedTrip.endPlace || 'Destination'}`;
      doc.text(doc.splitTextToSize(routeStr, cardW - 6)[0] || routeStr, c2x + 3, y + 8.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`${savedTrip.startDate || '-'} to ${savedTrip.endDate || '-'}${tripDays > 0 ? ` (${tripDays} ${tripDays === 1 ? 'day' : 'days'})` : ''}`, c2x + 3, y + 13.5);

      // Card 3: Distance, Diesel & Efficiency
      const c3x = left + (cardW * 2) + 6;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(c3x, y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(37, 99, 235);
      doc.text('DISTANCE, FUEL & MILEAGE', c3x + 3, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(30, 64, 175);
      doc.text(`${reportTotals.totalKm.toLocaleString('en-IN')} KM | ${reportTotals.totalLitres || 0} L`, c3x + 3, y + 8.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(5, 150, 105);
      doc.text(`Mileage: ${reportTotals.mileage > 0 ? `${reportTotals.mileage} KM/L` : 'N/A'}`, c3x + 3, y + 13.5);

      y += cardH + 5;

      // 2. Freight Details & Payment Receipts
      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 33, 54);
      doc.text('1. Freight Details & Payment Receipts', left, y);
      y += 4;

      const fWidths = [10, 68, 28, 42, 34];
      doc.setFillColor(241, 245, 249);
      doc.rect(left, y, printableWidth, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      let fx = left + 2;
      ['LR', 'TRANSPORTER / ROUTE / MATERIAL', 'DATE', 'PAYMENT MODE / TYPE', 'AMOUNT'].forEach((h, i) => {
        doc.text(h, fx, y + 3.8);
        fx += fWidths[i];
      });
      y += 7.5;

      (savedTrip.freights || []).forEach((item, index) => {
        const lrTotal = number(item.amount) + (savedTrip.expenses?.loadingUnloadingExpenses?.length ? 0 : (number(item.loadingCharge) + number(item.unloadingCharge)));
        const advance = number(item.received);
        const balancePayments = Array.isArray(item.balancePayments) ? item.balancePayments : [];
        const balTotal = balancePayments.reduce((sum, b) => sum + number(b.amount), 0);
        const totalRec = advance + balTotal;
        const pending = Math.max(0, lrTotal - totalRec);

        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(String(index + 1), left + 2, y);

        const tName = item.transporterName ? `${item.transporterName}` : 'Transporter';
        const rName = `${item.from || ''} -> ${item.to || ''}`;
        const mName = `(${item.material || 'Cargo'}, ${item.weight || 0}t)`;
        const titleText = `${tName}: ${rName} ${mName}`;
        doc.text(doc.splitTextToSize(titleText, fWidths[1] - 3)[0] || '', left + fWidths[0] + 2, y);

        doc.setFont('helvetica', 'normal');
        doc.text(savedTrip.startDate || '-', left + fWidths[0] + fWidths[1] + 2, y);
        doc.text('Freight Billed', left + fWidths[0] + fWidths[1] + fWidths[2] + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.text(inr(lrTotal), pageWidth - left - 2, y, { align: 'right' });
        doc.setDrawColor(241, 245, 249);
        doc.line(left, y + 1.5, pageWidth - left, y + 1.5);
        y += 5;

        // Advance Received
        if (advance > 0 || item.received !== '') {
          checkPageBreak(8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(71, 85, 105);
          doc.text('- Advance Received', left + fWidths[0] + 4, y);
          doc.text(item.advanceDate || savedTrip.startDate || '-', left + fWidths[0] + fWidths[1] + 2, y);
          doc.text(item.paymentMode || 'GPay', left + fWidths[0] + fWidths[1] + fWidths[2] + 2, y);
          doc.setTextColor(5, 150, 105);
          doc.text(inr(advance), pageWidth - left - 2, y, { align: 'right' });
          y += 4.5;
        }

        // Balance Receipts
        balancePayments.forEach((bal, bIdx) => {
          checkPageBreak(8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(71, 85, 105);
          doc.text(`- Balance Installment #${bIdx + 1}`, left + fWidths[0] + 4, y);
          doc.text(bal.date || '-', left + fWidths[0] + fWidths[1] + 2, y);
          doc.text(bal.paymentMode || 'Account transfer', left + fWidths[0] + fWidths[1] + fWidths[2] + 2, y);
          doc.setTextColor(5, 150, 105);
          doc.text(inr(bal.amount), pageWidth - left - 2, y, { align: 'right' });
          y += 4.5;
        });

        // Pending from transporter
        if (pending > 0) {
          checkPageBreak(8);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.8);
          doc.setTextColor(180, 83, 9);
          doc.text('- Remaining Pending Balance', left + fWidths[0] + 4, y);
          doc.text('Due from transporter', left + fWidths[0] + fWidths[1] + fWidths[2] + 2, y);
          doc.text(inr(pending), pageWidth - left - 2, y, { align: 'right' });
          y += 4.5;
        }
        doc.setDrawColor(226, 232, 240);
        doc.line(left, y - 0.5, pageWidth - left, y - 0.5);
        y += 2;
      });

      // Freight Totals Bar
      checkPageBreak(12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(left, y, printableWidth, 10, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Freight: ${inr(reportTotals.freight)}`, left + 4, y + 4);
      doc.setTextColor(5, 150, 105);
      doc.text(`Adv Rec: ${inr(reportTotals.advanceReceived)}`, left + 54, y + 4);
      doc.text(`Bal Rec: ${inr(reportTotals.balanceReceived)}`, left + 96, y + 4);
      doc.text(`Total Rec: ${inr(reportTotals.received)}`, left + 138, y + 4);
      doc.setTextColor(reportTotals.pending > 0 ? 180 : 5, reportTotals.pending > 0 ? 83 : 150, reportTotals.pending > 0 ? 9 : 105);
      doc.text(`PENDING TO RECEIVE FROM TRANSPORTER: ${inr(reportTotals.pending)}`, left + 4, y + 8);
      y += 14;

      // 2. Trip Overall Expenses & Net Profit
      checkPageBreak(45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 33, 54);
      doc.text('2. Trip Overall Expenses & Net Profit', left, y);
      y += 4.5;

      const totalTripExpenses = reportTotals.dieselTotal + reportTotals.tolls + reportTotals.loadingUnloadingTotal + reportTotals.policeRto + reportTotals.vehicleExpenses + reportTotals.otherExpenses + (reportTotals.driverBata || 0);
      const overallNetProfit = reportTotals.freight - totalTripExpenses;

      const tollCount = (savedTrip.expenses?.tolls || []).length;
      const loadingCount = (savedTrip.expenses?.loadingUnloadingExpenses || []).length;
      const policeCount = (savedTrip.expenses?.policeRtoExpenses || []).length;
      const billCount = (savedTrip.expenses?.vehicleExpenses || []).length;
      const otherCount = (savedTrip.expenses?.otherExpenses || []).length;

      const opsItems = [
        ['Diesel expense', `${reportTotals.totalLitres || 0} L diesel consumed across ${reportTotals.totalKm} KM | Mileage: ${reportTotals.mileage > 0 ? `${reportTotals.mileage} KM/L` : 'N/A'}`, reportTotals.dieselTotal],
        ['FASTag toll expense', `${tollCount} toll plaza / statement entries`, reportTotals.tolls],
        ['Loading & unloading charges', `${loadingCount} entries (hamali / coolie / loading charges)`, reportTotals.loadingUnloadingTotal],
        ['Police case & RTO expense', `${policeCount} checkpoint, fine, permit & case entries`, reportTotals.policeRto],
        ['Bill expenses (repairs & maintenance)', `${billCount} bill entries (Tyre puncture, AdBlue oil, grease & repairs)`, reportTotals.vehicleExpenses],
        ['Other expenses', `${otherCount} other entries (Food, daily expenses & misc.)`, reportTotals.otherExpenses],
        ...(reportTotals.driverBata > 0 ? [[`Driver bata allowance (${reportTotals.driverBataPct}%)`, 'Driver trip bata allowance on freight', reportTotals.driverBata]] : []),
        ['TOTAL TRIP EXPENSES', 'Total expenses incurred for this trip (Diesel + Tolls + Bills + Misc)', totalTripExpenses],
        ['NET PROFIT', 'Total Freight Collection minus Total Trip Expenses', overallNetProfit],
        ['PENDING FREIGHT TO RECEIVE', 'Balance freight still due from transporters', reportTotals.pending],
      ];

      opsItems.forEach(([label, desc, val]) => {
        checkPageBreak(8);
        const isHighlight = label === 'TOTAL TRIP EXPENSES' || label === 'NET PROFIT' || label === 'PENDING FREIGHT TO RECEIVE';
        doc.setDrawColor(isHighlight ? 203 : 241, isHighlight ? 213 : 245, isHighlight ? 225 : 249);
        doc.line(left, y + 1.2, pageWidth - left, y + 1.2);
        doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
        doc.setFontSize(isHighlight ? 7.8 : 7);
        doc.setTextColor(isHighlight ? 15 : 71, isHighlight ? 23 : 85, isHighlight ? 42 : 105);
        doc.text(label, left + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(desc, left + 76, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isHighlight ? 8 : 7.2);
        if (label === 'NET PROFIT') {
          doc.setTextColor(val >= 0 ? 5 : 220, val >= 0 ? 150 : 38, val >= 0 ? 105 : 38);
        } else if (label === 'PENDING FREIGHT TO RECEIVE') {
          doc.setTextColor(val > 0 ? 180 : 5, val > 0 ? 83 : 150, val > 0 ? 9 : 105);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(inr(val), pageWidth - left - 2, y, { align: 'right' });
        y += isHighlight ? 6.5 : 5;
      });
      y += 6;

      // 4. Driver Operated Expenses & Settlement Account
      checkPageBreak(45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 33, 54);
      doc.text('3. Driver Operated Expenses & Advance Settlement', left, y);
      y += 4.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('A. Driver Operated Expenses (Incurred & Paid by Driver En Route):', left + 2, y);
      y += 4;

      const driverExpenseRows = [];
      (savedTrip.diesel || []).filter(d => number(d.paidByDriver) > 0).forEach(d => {
        const rate = number(d.litres) ? (number(d.amount) / number(d.litres)).toFixed(2) : '-';
        driverExpenseRows.push(['Diesel', d.station || 'Fuel pump', d.date || '-', `${d.litres || 0} L`, `KM: ${d.km || '-'} (INR ${rate}/L)`, number(d.paidByDriver)]);
      });
      (savedTrip.expenses?.loadingUnloadingExpenses || []).filter(l => number(l.paidByDriver) > 0).forEach(l => {
        driverExpenseRows.push(['Loading/Unload', `${l.type || 'Loading'}: ${l.place || 'Godown'}`, l.date || '-', '-', 'Driver paid', number(l.paidByDriver)]);
      });
      (savedTrip.expenses?.tolls || []).filter(t => number(t.paidByDriver) > 0).forEach(t => {
        driverExpenseRows.push(['FASTag Toll', t.location || 'Plaza toll', t.date || '-', '-', 'Driver paid', number(t.paidByDriver)]);
      });
      (savedTrip.expenses?.policeRtoExpenses || []).filter(p => number(p.paidByDriver) > 0).forEach(p => {
        driverExpenseRows.push(['Police / RTO', p.name || 'Checkpoint/Fine', p.date || '-', '-', 'Driver paid', number(p.paidByDriver)]);
      });
      (savedTrip.expenses?.otherExpenses || []).filter(o => number(o.paidByDriver) > 0).forEach(o => {
        driverExpenseRows.push(['Other Expense', o.name || 'Expense', o.date || '-', '-', 'Driver paid', number(o.paidByDriver)]);
      });
      (savedTrip.expenses?.vehicleExpenses || []).filter(v => number(v.paidByDriver) > 0).forEach(v => {
        driverExpenseRows.push(['Bill Expense', v.name || v.type || 'Repair', v.date || '-', '-', 'Driver paid', number(v.paidByDriver)]);
      });

      if (driverExpenseRows.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.8);
        doc.setTextColor(148, 163, 184);
        doc.text('No driver-operated expenses recorded for this trip.', left + 4, y);
        y += 5.5;
      } else {
        const dWidths = [24, 52, 22, 18, 38, 28];
        doc.setFillColor(241, 245, 249);
        doc.rect(left, y, printableWidth, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(51, 65, 85);
        let dx = left + 2;
        ['EXPENSE', 'DETAILS / LOCATION', 'DATE', 'LITRES', 'KM / RATE', 'AMOUNT'].forEach((h, i) => {
          doc.text(h, dx, y + 3.5);
          dx += dWidths[i];
        });
        y += 6.5;

        driverExpenseRows.forEach(([category, detail, date, litres, kmRate, amt]) => {
          checkPageBreak(7);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(51, 65, 85);
          doc.text(category, left + 2, y);
          doc.text(doc.splitTextToSize(detail, dWidths[1] - 2)[0] || '', left + dWidths[0] + 2, y);
          doc.text(date, left + dWidths[0] + dWidths[1] + 2, y);
          doc.text(litres, left + dWidths[0] + dWidths[1] + dWidths[2] + 2, y);
          doc.text(kmRate, left + dWidths[0] + dWidths[1] + dWidths[2] + dWidths[3] + 2, y);
          doc.setFont('helvetica', 'bold');
          doc.text(inr(amt), pageWidth - left - 2, y, { align: 'right' });
          y += 4.5;
        });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(`Total Driver-Operated Expenses: ${inr(reportTotals.totalDriverExpenses)}`, pageWidth - left - 2, y, { align: 'right' });
        y += 7;
      }

      // Driver Advance & Settlement Ledger
      checkPageBreak(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('B. Driver Advance Ledger & Settlement Balance:', left + 2, y);
      y += 4;

      const advEntries = savedTrip.expenses?.driverAdvances || [];
      const advDesc = advEntries.length
        ? advEntries.map(a => `${a.date || '-'}: ${inr(a.amount)}`).join(' | ')
        : 'No advances recorded';

      const setRows = [
        ['Driver Advance Given (Gross)', advDesc, inr(reportTotals.grossDriverAdvance)],
        ['Less: Expenses paid by driver', 'Subtracted from advance', `- ${inr(reportTotals.totalDriverExpenses)}`],
        ['Net Advance with Driver', 'Advance remaining in driver hand', inr(reportTotals.driverAdvance)],
        ['Driver Bata / Commission Earned', reportTotals.driverBataPct > 0 ? `${reportTotals.driverBataPct}% of freight` : 'Commission', `+ ${inr(reportTotals.driverBata || reportTotals.commission)}`],
        ...(reportTotals.driverBalancePaid > 0 ? [['Driver Balance Paid during trip', 'Paid towards settlement', `- ${inr(reportTotals.driverBalancePaid)}`]] : []),
      ];

      setRows.forEach(([lbl, sub, val]) => {
        checkPageBreak(7);
        doc.setDrawColor(241, 245, 249);
        doc.line(left, y + 1.2, pageWidth - left, y + 1.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(lbl, left + 2, y);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(doc.splitTextToSize(sub, 90)[0] || '', left + 76, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(val, pageWidth - left - 2, y, { align: 'right' });
        y += 4.8;
      });

      // Final Status Box - High Contrast & Unmistakable
      y += 2.5;
      checkPageBreak(15);
      const isPayable = reportTotals.finalPayable > 0;
      const isRecoverable = reportTotals.finalPayable < 0;

      doc.setFillColor(isPayable ? 254 : isRecoverable ? 240 : 241, isPayable ? 242 : isRecoverable ? 253 : 245, isPayable ? 242 : isRecoverable ? 244 : 249);
      doc.setDrawColor(isPayable ? 220 : isRecoverable ? 34 : 100, isPayable ? 38 : isRecoverable ? 197 : 116, isPayable ? 38 : isRecoverable ? 94 : 139);
      doc.roundedRect(left, y, printableWidth, 11, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);

      if (isPayable) {
        doc.setTextColor(185, 28, 28);
        doc.text(`>>> STILL WANT TO PAY TO DRIVER: ${inr(reportTotals.finalPayable)} <<<`, left + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(153, 27, 27);
        doc.text('Driver has an outstanding payable balance of this amount for this trip.', left + 4, y + 8.8);
      } else if (isRecoverable) {
        doc.setTextColor(21, 128, 61);
        doc.text(`>>> EXCESS ADVANCE WITH DRIVER (RECOVERABLE): ${inr(Math.abs(reportTotals.finalPayable))} <<<`, left + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(22, 101, 52);
        doc.text('Driver has excess advance remaining; adjust in next trip or recover.', left + 4, y + 8.8);
      } else {
        doc.setTextColor(5, 150, 105);
        doc.text('>>> DRIVER ACCOUNT FULLY SETTLED (NIL BALANCE) <<<', left + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text('All advances, expenses and bata match exactly with zero remaining balance.', left + 4, y + 8.8);
      }

      const filename = `${settings.transporter || DEFAULT_SETTINGS.transporter} ${savedTrip.tripNumber || 'Trip Sheet'}`
        .replace(/[<>:"/\\|?*]+/g, '-').trim();
      doc.save(`${filename}.pdf`);
    setToast(`PDF saved: ${filename}.pdf`);
    } catch (error) {
      console.error('Unable to generate the trip sheet PDF.', error);
      setToast('Unable to generate the PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }, [pdfLoading, settings]);

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => new Date(b.updatedAt || b.savedAt) - new Date(a.updatedAt || a.savedAt)), [trips]);
  const overallPending = useMemo(() => sortedTrips.reduce((sum, item) => sum + calculate(item).pending, 0), [sortedTrips]);
  const freightDetails = useMemo(() => sortedTrips.flatMap((savedTrip) => (savedTrip.freights || []).map((freight, index) => {
    const hasLoadingExpenses = Array.isArray(savedTrip.expenses?.loadingUnloadingExpenses) && savedTrip.expenses.loadingUnloadingExpenses.length > 0;
    const totalLr = number(freight.amount) + (hasLoadingExpenses ? 0 : (number(freight.loadingCharge) + number(freight.unloadingCharge)));
    const balTotal = (freight.balancePayments || []).reduce((sum, b) => sum + number(b.amount), 0);
    const totalRec = number(freight.received) + balTotal;
    return {
      ...freight,
      totalLr,
      balTotal,
      totalRec,
      tripId: savedTrip.id,
      tripNumber: savedTrip.tripNumber,
      truck: savedTrip.truck,
      driver: savedTrip.driver,
      rowNumber: index + 1,
      settled: totalLr > 0 && totalRec >= totalLr,
    };
  })), [sortedTrips]);

  if (!isUnlocked) {
    return (
      <PinLockScreen
        correctPin={settings.appPin || '2026'}
        transporter={settings.transporter}
        toast={toast}
        onUnlock={(rememberDevice) => {
          try {
            sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
            if (rememberDevice) {
              localStorage.setItem(AUTH_LOCAL_KEY, 'true');
            }
          } catch {}
          setIsUnlocked(true);
          setToast(`Welcome to ${settings.transporter}`);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><img className="brand-logo" src={`${import.meta.env.BASE_URL}vetri-velavan-logo.jpeg`} alt="" /><div><strong>{settings.transporter}</strong><span>TRANSPORT ACCOUNTS</span></div></div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={page === 'dashboard'} icon="▦" onClick={() => navigate('dashboard')}>Dashboard</NavButton>
          <NavButton active={page === 'create'} icon="＋" onClick={() => navigate('create')}>Create trip</NavButton>
          <NavButton active={page === 'reports'} icon="▤" onClick={() => navigate('reports')}>Saved trips</NavButton>
          <NavButton active={page === 'freight'} icon="₹" onClick={() => navigate('freight')}>Freight details</NavButton>
          <NavButton active={page === 'vehicles'} icon="▰" onClick={() => navigate('vehicles')}>My vehicle</NavButton>
          <NavButton active={page === 'settings'} icon="⚙" onClick={() => navigate('settings')}>Settings</NavButton>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <span className="avatar">VVL</span>
            <div>
              <strong>Accounts workspace</strong>
              <span>{cloudStatus === 'synced' ? '☁️ Cloud synced' : cloudStatus === 'syncing' ? '⏳ Syncing cloud…' : 'Local + Cloud sync'}</span>
            </div>
          </div>
          <button className="sidebar-logout-btn" type="button" onClick={lockApp} title="Lock workspace / Log out">
            🔒 Log out
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <img className="brand-logo mobile-brand-logo" src={`${import.meta.env.BASE_URL}vetri-velavan-logo.jpeg`} alt="" />
            <div>
              <strong>{settings.transporter}</strong>
              <span style={{ display: 'block', fontSize: '9px', color: cloudStatus === 'synced' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {cloudStatus === 'synced' ? '● Cloud synced' : cloudStatus === 'syncing' ? '● Syncing...' : '● Local saved'}
              </span>
            </div>
            <button className="mobile-lock-btn" type="button" onClick={lockApp} title="Lock workspace / Log out" aria-label="Lock workspace">
              🔒
            </button>
          </div>
          <div className="topbar-right">
            <span className={`status-dot ${cloudStatus === 'synced' ? 'status-synced' : cloudStatus === 'syncing' ? 'status-syncing' : ''}`} />
            {cloudStatus === 'synced' ? 'Cloud synced ☁️' : cloudStatus === 'syncing' ? 'Syncing to cloud…' : cloudStatus === 'connecting' ? 'Connecting cloud…' : 'Saved locally'}
            <button className="topbar-lock-btn" type="button" onClick={lockApp} title="Lock workspace / Log out">
              🔒 Lock
            </button>
            <span className="avatar">VVL</span>
          </div>
        </header>
        <main className="main-content">
          {storageError && <div className="notice notice-error" role="alert">{storageError}</div>}
          {page === 'create' && (
            <TripEditor
              trip={trip} totals={totals} step={step} setStep={setStep} updateTrip={updateTrip}
              updateExpense={updateExpense} updateRow={updateRow} addRow={addRow}
              removeRow={removeRow} saveTrip={saveTrip} editing={Boolean(editingId)}
              transporter={settings.transporter} vehicles={Array.isArray(settings.vehicles) ? settings.vehicles : []}
              trips={trips}
              addFreightBalance={addFreightBalance}
              updateFreightBalance={updateFreightBalance}
              removeFreightBalance={removeFreightBalance}
            />
          )}
          {page === 'dashboard' && (
            <Dashboard
              trips={sortedTrips} pending={overallPending} onCreate={() => navigate('create')}
              onReports={() => navigate('reports')} onEdit={editTrip} onDelete={deleteTrip} onDownload={downloadPdf}
              transporter={settings.transporter} pdfLoading={pdfLoading}
            />
          )}
          {page === 'reports' && (
            <Reports trips={sortedTrips} pending={overallPending} onCreate={() => navigate('create')}
              onEdit={editTrip} onDelete={deleteTrip} onDownload={downloadPdf}
              transporter={settings.transporter} pdfLoading={pdfLoading} />
          )}
          {page === 'freight' && (
            <FreightDetails freights={freightDetails} onEdit={(tripId) => {
              const savedTrip = sortedTrips.find((item) => item.id === tripId);
              if (savedTrip) editTrip(savedTrip);
            }} onDelete={deleteTrip} transporter={settings.transporter} />
          )}
          {page === 'settings' && (
            <Settings settings={settings} setSettings={setSettings} trips={trips.length} setToast={setToast} lockApp={lockApp} />
          )}
          {page === 'vehicles' && (
            <Vehicles settings={settings} setSettings={setSettings} setToast={setToast} />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={page === 'dashboard'} icon="▦" onClick={() => navigate('dashboard')}>Home</NavButton>
        <NavButton active={page === 'create'} icon="＋" onClick={() => navigate('create')}>New trip</NavButton>
        <NavButton active={page === 'reports'} icon="▤" onClick={() => navigate('reports')}>Saved</NavButton>
        <NavButton active={page === 'freight'} icon="₹" onClick={() => navigate('freight')}>Freight</NavButton>
        <NavButton active={page === 'vehicles'} icon="▰" onClick={() => navigate('vehicles')}>Vehicles</NavButton>
        <NavButton active={page === 'settings'} icon="⚙" onClick={() => navigate('settings')}>Settings</NavButton>
      </nav>
      {toast && <div className="toast" role="status"><Icon>✓</Icon>{toast}</div>}
    </div>
  );
}

function NavButton({ active, icon, children, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} type="button" aria-current={active ? 'page' : undefined}>
      <span className="nav-icon">{icon}</span><span>{children}</span>
    </button>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function TripEditor({
  trip, totals, step, setStep, updateTrip, updateExpense, updateRow, addRow, removeRow,
  saveTrip, editing, transporter, vehicles, trips,
  addFreightBalance, updateFreightBalance, removeFreightBalance
}) {
  const tabs = [
    { title: 'Trip & freight', icon: '↗' },
    { title: 'Fuel & expenses', icon: '⛽' },
    { title: 'Settlement', icon: '₹' },
  ];
  return (
    <>
      <PageHeading eyebrow={transporter} title={editing ? 'Edit trip sheet' : 'Create trip sheet'}
        description="Record the trip details, freight and driver settlement in one place."
        action={<span className="trip-number-chip"><Icon>▤</Icon>{trip.tripNumber || 'New trip'}</span>} />
      <div className="step-tabs" role="tablist" aria-label="Trip form sections">
        {tabs.map((tab, index) => (
          <button key={tab.title} type="button" role="tab" aria-selected={step === index}
            className={`step-tab ${step === index ? 'selected' : ''}`} onClick={() => setStep(index)}>
            <span className="step-index">{step > index ? '✓' : tab.icon}</span><span>{index + 1}. {tab.title}</span>
          </button>
        ))}
      </div>
      <form className="editor-form" onSubmit={saveTrip}>
        {step === 0 && (
          <TripDetails
            trip={trip}
            updateTrip={updateTrip}
            totals={totals}
            addRow={addRow}
            updateRow={updateRow}
            removeRow={removeRow}
            vehicles={vehicles}
            trips={trips}
            addFreightBalance={addFreightBalance}
            updateFreightBalance={updateFreightBalance}
            removeFreightBalance={removeFreightBalance}
          />
        )}
        {step === 1 && <TripExpenses trip={trip} totals={totals} updateExpense={updateExpense} updateRow={updateRow} addRow={addRow} removeRow={removeRow} />}
        {step === 2 && <Settlement trip={trip} totals={totals} updateExpense={updateExpense} />}
        <div className="form-navigation">
          {step > 0
            ? <Button type="button" onClick={() => setStep(step - 1)}>← Back</Button>
            : <span />}
          {step < 2
            ? <Button variant="primary" type="button" onClick={() => setStep(step + 1)}>Continue to {tabs[step + 1].title} <span>→</span></Button>
            : <button className="button button-accent save-button" type="submit"><Icon>✓</Icon>{editing ? 'Save trip changes' : 'Save trip sheet'}</button>}
        </div>
      </form>
    </>
  );
}

function TripDetails({ trip, updateTrip, totals, addRow, updateRow, removeRow, vehicles, trips, addFreightBalance, updateFreightBalance, removeFreightBalance }) {
  return (
    <>
      <section className="panel">
        <SectionTitle icon="↗">Trip information</SectionTitle>
        <div className="form-grid">
          <Field
            label="Trip sheet number"
            value={trip.tripNumber}
            onChange={(value) => updateTrip('tripNumber', value)}
            placeholder={getNextTripNumber(trips, trip.startDate)}
            required
          />
          <label className="field">
            <span>Vehicle number</span>
            <input
              list="vehicles-datalist"
              required
              value={trip.truck || ''}
              onChange={(event) => updateTrip('truck', event.target.value.toUpperCase())}
              placeholder="Select or enter vehicle (e.g. AP 28 TC 5542)"
            />
            <datalist id="vehicles-datalist">
              {vehicles.map((vehicle) => (
                <option key={vehicle} value={vehicle}>
                  {vehicle}
                </option>
              ))}
            </datalist>
          </label>
          <Field label="Assigned driver" value={trip.driver} onChange={(value) => updateTrip('driver', value)} required />
        </div>

        {/* Dates and Origin/Destination Places */}
        <div className="dates-places-grid">
          <div className="date-place-card origin-card">
            <div className="date-place-card-title">
              <span>🚩 Trip Origin / Start</span>
            </div>
            <div className="date-place-card-fields">
              <Field
                label="Start date"
                type="date"
                value={trip.startDate}
                onChange={(value) => {
                  updateTrip('startDate', value);
                  // Auto-update trip number if user hasn't typed a custom one
                  if (!trip.tripNumber || trip.tripNumber === getNextTripNumber(trips, trip.startDate)) {
                    updateTrip('tripNumber', getNextTripNumber(trips, value));
                  }
                }}
              />
              <Field
                label="Start place (Origin)"
                value={trip.startPlace || ''}
                onChange={(value) => updateTrip('startPlace', value)}
                placeholder="e.g. Salem, Namakkal, Sankagiri"
              />
            </div>
          </div>

          <div className="date-place-card dest-card">
            <div className="date-place-card-title">
              <span>🏁 Trip Destination / End</span>
            </div>
            <div className="date-place-card-fields">
              <Field
                label="End date"
                type="date"
                value={trip.endDate}
                onChange={(value) => updateTrip('endDate', value)}
              />
              <Field
                label="End place (Destination)"
                value={trip.endPlace || ''}
                onChange={(value) => updateTrip('endPlace', value)}
                placeholder="e.g. Chennai, Bangalore, Hyderabad"
              />
            </div>
          </div>

          <div className="dates-total-card">
            <span>Total duration</span>
            <strong>{calculateDays(trip.startDate, trip.endDate)} <small>{calculateDays(trip.startDate, trip.endDate) === 1 ? 'DAY' : 'DAYS'}</small></strong>
          </div>
        </div>

        <div className="odometer-row">
          <Field label="Start KM" type="number" min="0" value={trip.startKm} onChange={(value) => updateTrip('startKm', value)} />
          <Field label="End KM" type="number" min="0" value={trip.endKm} onChange={(value) => updateTrip('endKm', value)} />
          <div className="odometer-total">
            <span>Total distance & mileage</span>
            <div className="odometer-stats-flex">
              <strong>{Math.max(0, number(trip.endKm) - number(trip.startKm)).toLocaleString('en-IN')} <small>KM</small></strong>
              {totals.mileage > 0 && (
                <span className="odometer-mileage-tag" title="Calculated from total KM and diesel consumed">
                  ⚡ {totals.mileage} KM/L ({totals.totalLitres || 0} L)
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <SectionTitle icon="▣" action={<Button variant="primary" type="button" onClick={() => addRow('freights')}>＋ Add LR</Button>}>Freight details</SectionTitle>
        <div className="freight-entries-list">
          {trip.freights.map((row, index) => {
            const lrTotal = number(row.amount) + (trip.expenses?.loadingUnloadingExpenses?.length ? 0 : (number(row.loadingCharge) + number(row.unloadingCharge)));
            const advance = number(row.received);
            const balancePayments = Array.isArray(row.balancePayments) ? row.balancePayments : [];
            const balReceived = balancePayments.reduce((sum, b) => sum + number(b.amount), 0);
            const totalRec = advance + balReceived;
            const lrPending = Math.max(0, lrTotal - totalRec);
            return (
              <div className="freight-entry-card" key={row.id}>
                <div className="freight-card-header">
                  <div className="freight-card-tag">
                    <span className="lr-pill">LR #{String(index + 1).padStart(2, '0')}</span>
                    {row.transporterName ? (
                      <strong className="lr-transporter-tag">{row.transporterName}</strong>
                    ) : (
                      <span className="lr-transporter-tag" style={{ color: '#94a3b8' }}>LR Entry #{index + 1}</span>
                    )}
                  </div>
                  <button className="icon-button row-delete" type="button" onClick={() => removeRow('freights', row.id)} aria-label={`Remove freight row ${index + 1}`}>×</button>
                </div>

                <div className="freight-card-grid">
                  <Field label="Transporter name" value={row.transporterName || ''} onChange={(val) => updateRow('freights', row.id, 'transporterName', val)} placeholder="e.g. VRL Logistics, Sri Murugan" />
                  <Field label="Transporter number" value={row.transporterNumber || ''} onChange={(val) => updateRow('freights', row.id, 'transporterNumber', val)} placeholder="Phone / contact no." />
                  <Field label="From (Origin)" value={row.from} onChange={(value) => updateRow('freights', row.id, 'from', value)} placeholder="Origin city / town" />
                  <Field label="To (Destination)" value={row.to} onChange={(value) => updateRow('freights', row.id, 'to', value)} placeholder="Destination city / town" />
                  <Field label="Material" value={row.material} onChange={(value) => updateRow('freights', row.id, 'material', value)} placeholder="Goods description" />
                  <Field label="Weight (Tons)" type="number" min="0" step="0.1" value={row.weight} onChange={(value) => updateRow('freights', row.id, 'weight', value)} placeholder="0.0" />
                  <Field label="Freight amount (₹)" type="number" min="0" value={row.amount} onChange={(value) => updateRow('freights', row.id, 'amount', value)} placeholder="0" />
                  <Field label="Advance received (₹)" type="number" min="0" value={row.received} onChange={(value) => updateRow('freights', row.id, 'received', value)} placeholder="0" />
                  <Field label="Advance date" type="date" value={row.advanceDate || trip.startDate || today} onChange={(value) => updateRow('freights', row.id, 'advanceDate', value)} />
                  <label className="field">
                    <span>Advance payment mode</span>
                    <select
                      className="field-select"
                      value={row.paymentMode || 'GPay'}
                      onChange={(e) => updateRow('freights', row.id, 'paymentMode', e.target.value)}
                    >
                      <option value="GPay">GPay</option>
                      <option value="Account transfer">Account transfer</option>
                      <option value="Cash to owner">Cash to owner</option>
                      <option value="Cash to driver">Cash to driver</option>
                    </select>
                  </label>
                </div>

                {/* Multiple Balance Payments Section */}
                <div className="freight-balance-section">
                  <div className="freight-balance-header">
                    <div>
                      <strong>Balance payments received ({balancePayments.length})</strong>
                      <span className="balance-header-sub">Record multiple installments as transporter pays balance (e.g. ₹10,000, then ₹40,000)</span>
                    </div>
                    <Button type="button" className="btn-add-balance" onClick={() => addFreightBalance(row.id)}>＋ Add balance amount</Button>
                  </div>

                  {balancePayments.length > 0 ? (
                    <div className="freight-balance-list">
                      {balancePayments.map((bal, bIdx) => (
                        <div className="balance-payment-item" key={bal.id}>
                          <span className="balance-idx-chip">Balance #{bIdx + 1}</span>
                          <Field
                            label="Balance amount (₹)"
                            type="number"
                            min="0"
                            value={bal.amount}
                            onChange={(val) => updateFreightBalance(row.id, bal.id, 'amount', val)}
                            placeholder="0"
                          />
                          <Field
                            label="Received date"
                            type="date"
                            value={bal.date}
                            onChange={(val) => updateFreightBalance(row.id, bal.id, 'date', val)}
                          />
                          <label className="field">
                            <span>Mode of payment</span>
                            <select
                              className="field-select"
                              value={bal.paymentMode || 'Account transfer'}
                              onChange={(e) => updateFreightBalance(row.id, bal.id, 'paymentMode', e.target.value)}
                            >
                              <option value="Account transfer">Account transfer</option>
                              <option value="GPay">GPay</option>
                              <option value="Cash to owner">Cash to owner</option>
                              <option value="Cash to driver">Cash to driver</option>
                            </select>
                          </label>
                          <button
                            className="icon-button row-delete"
                            type="button"
                            onClick={() => removeFreightBalance(row.id, bal.id)}
                            aria-label={`Remove balance receipt ${bIdx + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="balance-empty-hint">No balance payments recorded yet. Click “＋ Add balance amount” when transporter pays further installments.</div>
                  )}
                </div>

                <div className="freight-card-footer">
                  <div className="freight-footer-item">
                    <span>Total LR Billing:</span>
                    <strong>{amount(lrTotal)}</strong>
                  </div>
                  <div className="freight-footer-item">
                    <span>Advance ({row.paymentMode || 'GPay'}):</span>
                    <strong style={{ color: '#059669' }}>{amount(advance)}</strong>
                  </div>
                  {balReceived > 0 && (
                    <div className="freight-footer-item">
                      <span>Balance receipts ({balancePayments.length}):</span>
                      <strong style={{ color: '#059669' }}>{amount(balReceived)}</strong>
                    </div>
                  )}
                  <div className="freight-footer-item">
                    <span>Total received:</span>
                    <strong style={{ color: '#059669' }}>{amount(totalRec)}</strong>
                  </div>
                  <div className="freight-footer-item">
                    <span>Remaining pending:</span>
                    <strong style={{ color: lrPending > 0 ? '#b45309' : '#059669' }}>{amount(lrPending)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
          {trip.freights.length === 0 && <div className="empty-row">No freight entries yet. Select “＋ Add LR” to start.</div>}
        </div>
        <div className="total-strip freight-summary-strip">
          <div><span>Freight billed: </span><strong>{amount(totals.freightAmount ?? totals.freight)}</strong></div>
          <div><span>Advance received: </span><strong style={{ color: '#059669' }}>{amount(totals.advanceReceived ?? totals.received)}</strong></div>
          {number(totals.balanceReceived) > 0 && (
            <div><span>Balance received: </span><strong style={{ color: '#059669' }}>{amount(totals.balanceReceived)}</strong></div>
          )}
          <div><span>Total received: </span><strong style={{ color: '#059669' }}>{amount(totals.received)}</strong></div>
          <div><span>Pending balance: </span><strong style={{ color: totals.pending ? '#b45309' : '#059669' }}>{amount(totals.pending)}</strong></div>
        </div>
      </section>
    </>
  );
}

function InlineInput({ label, value, onChange, type = 'text', ...props }) {
  return <input aria-label={label} placeholder={label} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />;
}

function TripExpenses({ trip, totals, updateExpense, updateRow, addRow, removeRow }) {
  return (
    <>
      <section className="panel">
        <SectionTitle icon="⛽" action={<Button type="button" onClick={() => addRow('diesel')}>＋ Add pump</Button>}>Diesel expense</SectionTitle>
        <div className="entry-list">
          {trip.diesel.map((row, index) => {
            const rowTotal = (number(row.paidByOwner) + number(row.paidByDriver)) || number(row.amount);
            return (
              <div className="entry-card diesel-entry" key={row.id}>
                <Field label="Station / location" value={row.station} onChange={(value) => updateRow('diesel', row.id, 'station', value)} placeholder="Pump name" />
                <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow('diesel', row.id, 'date', value)} />
                <Field label="Litres" type="number" min="0" step="0.1" value={row.litres} onChange={(value) => updateRow('diesel', row.id, 'litres', value)} />
                <Field label="KM (Odometer)" type="number" min="0" value={row.km ?? ''} onChange={(value) => updateRow('diesel', row.id, 'km', value)} placeholder="e.g. 45600" />
                <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner} onChange={(value) => updateRow('diesel', row.id, 'paidByOwner', value)} placeholder="0" />
                <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver} onChange={(value) => updateRow('diesel', row.id, 'paidByDriver', value)} placeholder="0" />
                <div className="entry-rate">
                  <span>Rate / litre</span>
                  <strong>{amount(number(row.litres) ? rowTotal / number(row.litres) : 0)} /L</strong>
                  {number(row.paidByOwner) > 0 && number(row.paidByDriver) > 0 && (
                    <small style={{ fontSize: '10px', color: '#64748b' }}>Total: {amount(rowTotal)}</small>
                  )}
                </div>
                <button className="icon-button row-delete" type="button" onClick={() => removeRow('diesel', row.id)} aria-label={`Remove diesel entry ${index + 1}`}>×</button>
              </div>
            );
          })}
          {!trip.diesel.length && <div className="empty-row">No diesel entries yet.</div>}
        </div>
        <div className="total-strip diesel-summary-strip">
          <div><span>Paid by owner (expense): </span><strong>{amount(totals.dieselOwner)}</strong></div>
          <div><span>Paid by driver (less advance): </span><strong>{amount(totals.dieselDriver)}</strong></div>
          <div><span>Total diesel: </span><strong>{amount(totals.dieselTotal)}</strong></div>
          <div><span>Total litres: </span><strong>{totals.totalLitres || 0} L</strong></div>
          {totals.mileage > 0 && (
            <div><span>Overall mileage: </span><strong style={{ color: '#2563eb' }}>{totals.mileage} KM/L</strong></div>
          )}
        </div>
      </section>
      <section className="panel">
        <SectionTitle icon="🚚">Loading & Unloading expense</SectionTitle>
        <LoadingUnloadingEntries rows={trip.expenses.loadingUnloadingExpenses || []} updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
      </section>
      <section className="panel">
        <SectionTitle icon="₹">Toll expense</SectionTitle>
        <TollEntries rows={trip.expenses.tolls || []} updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
      </section>
      <section className="panel">
        <SectionTitle icon="⚖">Police case & RTO expense</SectionTitle>
        <PoliceRtoEntries rows={trip.expenses.policeRtoExpenses || []} updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
      </section>
      <section className="panel">
        <SectionTitle icon="▣">Bill expense</SectionTitle>
        <BillExpenseEntries rows={trip.expenses.vehicleExpenses} updateRow={updateRow}
          addRow={addRow} removeRow={removeRow} />
      </section>
      <section className="panel">
        <SectionTitle icon="₹">Other expense</SectionTitle>
        <OtherExpenseEntries rows={trip.expenses.otherExpenses} updateRow={updateRow}
          addRow={addRow} removeRow={removeRow} />
      </section>
      <section className="panel">
        <SectionTitle icon="▤">Driver costs</SectionTitle>
        <DriverPaymentEntries group="driverAdvances" title="Driver advance payments" rows={trip.expenses.driverAdvances}
          amountLabel="Advance amount (₹)" totalLabel="Total advances recorded" emptyText="No driver advances recorded."
          updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
        {totals.dieselDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Diesel paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.dieselDriver)}</strong>
          </div>
        )}
        {totals.loadingDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Loading & unloading paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.loadingDriver)}</strong>
          </div>
        )}
        {totals.tollsDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Tolls paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.tollsDriver)}</strong>
          </div>
        )}
        {totals.policeDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Police & RTO paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.policeDriver)}</strong>
          </div>
        )}
        {totals.otherDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Other expenses paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.otherDriver)}</strong>
          </div>
        )}
        {totals.vehicleDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Bill expenses paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.vehicleDriver)}</strong>
          </div>
        )}
        <div className="driver-advance-net">
          <span>Net advance (advance less all driver-paid expenses)</span>
          <strong>{amount(totals.driverAdvance)}</strong>
        </div>
        <DriverPaymentEntries group="driverBalancePayments" title="Driver balance payments" rows={trip.expenses.driverBalancePayments}
          amountLabel="Balance paid (₹)" totalLabel="Total balance paid" emptyText="No balance payments recorded."
          updateRow={updateRow} addRow={addRow} removeRow={removeRow} />
        <div className="driver-balance-summary">
          <span>Final settlement balance</span>
          <strong className={totals.finalPayable < 0 ? 'positive' : 'negative'}>
            {totals.finalPayable > 0 ? `Still pay to driver: ${amount(totals.finalPayable)}` : totals.finalPayable < 0 ? `Advance with driver: ${amount(Math.abs(totals.finalPayable))}` : 'Fully settled (₹0)'}
          </strong>
        </div>
      </section>
    </>
  );
}

function LoadingUnloadingEntries({ rows, updateRow, addRow, removeRow }) {
  const ownerTotal = (rows || []).reduce((sum, row) => {
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + number(row.amount);
  }, 0);
  const driverTotal = (rows || []).reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);
  const total = ownerTotal + driverTotal;

  return (
    <div className="repeatable-block">
      <div className="repeatable-heading">
        <strong>Hamali, loading & unloading charges</strong>
        <Button type="button" onClick={() => addRow('loadingUnloadingExpenses')}>＋ Add loading / unloading</Button>
      </div>
      {(rows || []).map((row, index) => (
        <div className="repeatable-row loading-expense-row expense-split-card" key={row.id}>
          <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow('loadingUnloadingExpenses', row.id, 'date', value)} />
          <label className="field">
            <span>Charge type</span>
            <select
              className="field-select"
              value={row.type || 'Loading charge'}
              onChange={(e) => updateRow('loadingUnloadingExpenses', row.id, 'type', e.target.value)}
            >
              <option value="Loading charge">Loading charge</option>
              <option value="Unloading charge">Unloading charge</option>
              <option value="Both (Loading & Unloading)">Both (Loading & Unloading)</option>
              <option value="Hamali / Coolie">Hamali / Coolie</option>
            </select>
          </label>
          <Field label="Place name / Warehouse" value={row.place || ''} onChange={(value) => updateRow('loadingUnloadingExpenses', row.id, 'place', value)} placeholder="e.g. Hyderabad Godown, Port" />
          <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(value) => updateRow('loadingUnloadingExpenses', row.id, 'paidByOwner', value)} placeholder="0" />
          <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(value) => updateRow('loadingUnloadingExpenses', row.id, 'paidByDriver', value)} placeholder="0" />
          <div className="entry-rate">
            <span>Total</span>
            <strong>{amount(number(row.paidByOwner) + number(row.paidByDriver) || number(row.amount))}</strong>
          </div>
          <button
            className="icon-button row-delete"
            type="button"
            onClick={() => removeRow('loadingUnloadingExpenses', row.id)}
            aria-label={`Remove loading charge ${index + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      {(!rows || !rows.length) && <div className="empty-row">No loading or unloading charges recorded.</div>}
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (operating expense): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total loading & unloading: </span><strong>{amount(total)}</strong></div>
      </div>
    </div>
  );
}

function BillExpenseEntries({ rows, updateRow, addRow, removeRow }) {
  const ownerTotal = rows.reduce((sum, row) => {
    const base = row.type === 'AdBlue oil refill' ? number(row.litres) * number(row.rate) : number(row.amount);
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + base;
  }, 0);
  const driverTotal = rows.reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);
  const total = ownerTotal + driverTotal;

  return (
    <>
      <div className="repeatable-heading">
        <strong>Tyre puncture, AdBlue oil refill, grease work, and other bills</strong>
        <Button type="button" onClick={() => addRow('vehicleExpenses')}>＋ Add entry</Button>
      </div>
      <div className="vehicle-expense-list">
        {rows.map((row, index) => {
          const isAdBlue = row.type === 'AdBlue oil refill';
          const isOther = row.type === 'Other';
          const baseAmount = isAdBlue ? number(row.litres) * number(row.rate) : number(row.amount);
          return (
            <div className="vehicle-expense-row expense-split-card" key={row.id}>
              <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow('vehicleExpenses', row.id, 'date', value)} />
              <label className="field"><span>Expense type</span>
                <select value={row.type || 'Other'} onChange={(event) => updateRow('vehicleExpenses', row.id, 'type', event.target.value)}>
                  <option>Tyre puncture</option><option>AdBlue oil refill</option><option>Grease work</option><option>Other</option>
                </select>
              </label>
              {isOther
                ? <Field label="Expense name" value={row.name} onChange={(value) => updateRow('vehicleExpenses', row.id, 'name', value)} placeholder="e.g. Spare part" />
                : <div className="vehicle-expense-description"><span>Description</span><strong>{row.type || '—'}</strong></div>}
              {isAdBlue
                ? <Field label="Litres" type="number" min="0" step="0.1" value={row.litres} onChange={(value) => updateRow('vehicleExpenses', row.id, 'litres', value)} />
                : <div className="vehicle-expense-placeholder"><span>Litres</span><strong>—</strong></div>}
              {isAdBlue
                ? <Field label="Rate / litre (₹)" type="number" min="0" step="0.01" value={row.rate} onChange={(value) => updateRow('vehicleExpenses', row.id, 'rate', value)} />
                : <div className="vehicle-expense-placeholder"><span>Rate / litre</span><strong>—</strong></div>}
              <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(value) => updateRow('vehicleExpenses', row.id, 'paidByOwner', value)} placeholder="0" />
              <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(value) => updateRow('vehicleExpenses', row.id, 'paidByDriver', value)} placeholder="0" />
              <div className="entry-rate">
                <span>Total amount</span>
                <strong>{amount(baseAmount || (number(row.paidByOwner) + number(row.paidByDriver)))}</strong>
              </div>
              <button className="icon-button row-delete" type="button" onClick={() => removeRow('vehicleExpenses', row.id)}
                aria-label={`Remove vehicle expense ${index + 1}`}>×</button>
            </div>
          );
        })}
        {!rows.length && <div className="empty-row">No bill expenses added yet.</div>}
      </div>
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (expense): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total bill expenses: </span><strong>{amount(total)}</strong></div>
      </div>
    </>
  );
}

function OtherExpenseEntries({ rows, updateRow, addRow, removeRow }) {
  const ownerTotal = rows.reduce((sum, row) => {
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + number(row.amount);
  }, 0);
  const driverTotal = rows.reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);
  const total = ownerTotal + driverTotal;
  return (
    <div className="repeatable-block">
      <div className="repeatable-heading"><strong>Other expense entries</strong>
        <Button type="button" onClick={() => addRow('otherExpenses')}>＋ Add entry</Button>
      </div>
      {rows.map((row, index) => (
        <div className="repeatable-row other-expense-row expense-split-card" key={row.id}>
          <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow('otherExpenses', row.id, 'date', value)} />
          <Field label="Expense name" value={row.name} onChange={(value) => updateRow('otherExpenses', row.id, 'name', value)} placeholder="e.g. Food, loading, or phone" />
          <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(value) => updateRow('otherExpenses', row.id, 'paidByOwner', value)} placeholder="0" />
          <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(value) => updateRow('otherExpenses', row.id, 'paidByDriver', value)} placeholder="0" />
          <div className="entry-rate"><span>Total</span><strong>{amount(number(row.paidByOwner) + number(row.paidByDriver) || number(row.amount))}</strong></div>
          <button className="icon-button row-delete" type="button" onClick={() => removeRow('otherExpenses', row.id)}
            aria-label={`Remove other expense ${index + 1}`}>×</button>
        </div>
      ))}
      {!rows.length && <div className="empty-row">No other expenses recorded.</div>}
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (expense): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total other expenses: </span><strong>{amount(total)}</strong></div>
      </div>
    </div>
  );
}

function DriverPaymentEntries({ group, title, rows, amountLabel, totalLabel, emptyText, updateRow, addRow, removeRow }) {
  const total = rows.reduce((sum, row) => sum + number(row.amount), 0);
  return (
    <div className="repeatable-block">
      <div className="repeatable-heading"><strong>{title}</strong>
        <Button type="button" onClick={() => addRow(group)}>＋ Add payment</Button>
      </div>
      {rows.map((row, index) => (
        <div className="driver-advance-row" key={row.id}>
          <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow(group, row.id, 'date', value)} />
          <Field label={amountLabel} type="number" min="0" value={row.amount} onChange={(value) => updateRow(group, row.id, 'amount', value)} />
          <button className="icon-button row-delete" type="button" onClick={() => removeRow(group, row.id)}
            aria-label={`Remove ${title.toLowerCase()} ${index + 1}`}>×</button>
        </div>
      ))}
      {!rows.length && <div className="empty-row">{emptyText}</div>}
      <div className="total-strip"><span>{totalLabel}</span><strong>{amount(total)}</strong></div>
    </div>
  );
}

function TollEntries({ rows, updateRow, addRow, removeRow }) {
  const ownerTotal = (rows || []).reduce((sum, row) => {
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + number(row.amount);
  }, 0);
  const driverTotal = (rows || []).reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);

  return (
    <div className="repeatable-block">
      <div className="repeatable-heading">
        <strong>FASTag & toll entries</strong>
        <Button type="button" onClick={() => addRow('tolls')}>＋ Add toll log</Button>
      </div>
      {(rows || []).map((row, index) => {
        const isDriverPaid = row.paidBy === 'driver' || (!row.paidBy && number(row.paidByDriver) > 0 && !number(row.paidByOwner));
        return (
          <div className="toll-entry-card" key={row.id}>
            <div className="toll-card-header">
              <label className="field-compact">
                <span>Paid by</span>
                <select
                  className="field-select"
                  value={isDriverPaid ? 'driver' : 'owner'}
                  onChange={(e) => {
                    const mode = e.target.value;
                    updateRow('tolls', row.id, 'paidBy', mode);
                    if (mode === 'owner') {
                      if (row.paidByDriver) {
                        updateRow('tolls', row.id, 'paidByOwner', row.paidByDriver);
                        updateRow('tolls', row.id, 'paidByDriver', '');
                      }
                    } else {
                      if (row.paidByOwner) {
                        updateRow('tolls', row.id, 'paidByDriver', row.paidByOwner);
                        updateRow('tolls', row.id, 'paidByOwner', '');
                      }
                    }
                  }}
                >
                  <option value="owner">Owner (Date to date statement, e.g. 23/11/2026 to 05/12/2026)</option>
                  <option value="driver">Driver (Plaza toll paid by driver)</option>
                </select>
              </label>
              <button
                className="icon-button row-delete"
                type="button"
                onClick={() => removeRow('tolls', row.id)}
                aria-label={`Remove toll entry ${index + 1}`}
              >
                ×
              </button>
            </div>

            <div className="toll-card-grid">
              {isDriverPaid ? (
                <>
                  <Field label="Date" type="date" value={row.date} onChange={(val) => updateRow('tolls', row.id, 'date', val)} />
                  <Field label="Plaza / location" value={row.location} onChange={(val) => updateRow('tolls', row.id, 'location', val)} placeholder="Toll plaza name" />
                  <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(val) => updateRow('tolls', row.id, 'paidByDriver', val)} placeholder="0" />
                </>
              ) : (
                <>
                  <Field label="From date" type="date" value={row.date} onChange={(val) => updateRow('tolls', row.id, 'date', val)} />
                  <Field label="To date" type="date" value={row.toDate || ''} onChange={(val) => updateRow('tolls', row.id, 'toDate', val)} />
                  <Field label="FASTag description" value={row.location || ''} onChange={(val) => updateRow('tolls', row.id, 'location', val)} placeholder="e.g. FASTag statement / recharge" />
                  <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(val) => updateRow('tolls', row.id, 'paidByOwner', val)} placeholder="0" />
                </>
              )}
            </div>
          </div>
        );
      })}
      {(!rows || !rows.length) && <div className="empty-row">No toll entries recorded.</div>}
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (statement): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total tolls: </span><strong>{amount(ownerTotal + driverTotal)}</strong></div>
      </div>
    </div>
  );
}

function PoliceRtoEntries({ rows, updateRow, addRow, removeRow }) {
  const ownerTotal = (rows || []).reduce((sum, row) => {
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + number(row.amount);
  }, 0);
  const driverTotal = (rows || []).reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);
  const total = ownerTotal + driverTotal;

  return (
    <div className="repeatable-block">
      <div className="repeatable-heading">
        <strong>Police case & RTO expenses</strong>
        <Button type="button" onClick={() => addRow('policeRtoExpenses')}>＋ Add police / RTO</Button>
      </div>
      {(rows || []).map((row, index) => (
        <div className="repeatable-row police-rto-row expense-split-card" key={row.id}>
          <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow('policeRtoExpenses', row.id, 'date', value)} />
          <Field label="Expense name / Reason" value={row.name} onChange={(value) => updateRow('policeRtoExpenses', row.id, 'name', value)} placeholder="e.g. Overload, Checkpost, RTO permit fine" />
          <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(value) => updateRow('policeRtoExpenses', row.id, 'paidByOwner', value)} placeholder="0" />
          <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(value) => updateRow('policeRtoExpenses', row.id, 'paidByDriver', value)} placeholder="0" />
          <div className="entry-rate"><span>Total</span><strong>{amount(number(row.paidByOwner) + number(row.paidByDriver) || number(row.amount))}</strong></div>
          <button className="icon-button row-delete" type="button" onClick={() => removeRow('policeRtoExpenses', row.id)}
            aria-label={`Remove police / RTO entry ${index + 1}`}>×</button>
        </div>
      ))}
      {(!rows || !rows.length) && <div className="empty-row">No police case or RTO expenses recorded.</div>}
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (expense): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total Police & RTO: </span><strong>{amount(total)}</strong></div>
      </div>
    </div>
  );
}

function Settlement({ trip, totals, updateExpense }) {
  const lines = [
    ['Freight collection', totals.freight, 'positive'],
    ['Diesel expense (Paid by owner)', -totals.dieselOwner],
    ...(totals.dieselDriver > 0 ? [['Diesel paid by driver (adjusted in advance)', -totals.dieselDriver, 'neutral']] : []),
    ['Loading & unloading (Paid by owner)', -totals.loadingOwner],
    ...(totals.loadingDriver > 0 ? [['Loading & unloading paid by driver (adjusted in advance)', -totals.loadingDriver, 'neutral']] : []),
    ['Other expenses (Paid by owner)', -totals.otherOwner],
    ...(totals.otherDriver > 0 ? [['Other expenses paid by driver (adjusted in advance)', -totals.otherDriver, 'neutral']] : []),
    ['Toll expense (Paid by owner)', -totals.tollsOwner],
    ...(totals.tollsDriver > 0 ? [['Tolls paid by driver (adjusted in advance)', -totals.tollsDriver, 'neutral']] : []),
    ['Police & RTO expenses (Paid by owner)', -totals.policeOwner],
    ...(totals.policeDriver > 0 ? [['Police & RTO paid by driver (adjusted in advance)', -totals.policeDriver, 'neutral']] : []),
    ['Bill expenses (Paid by owner)', -totals.vehicleOwner],
    ...(totals.vehicleDriver > 0 ? [['Bill expenses paid by driver (adjusted in advance)', -totals.vehicleDriver, 'neutral']] : []),
    ...(totals.driverBata > 0 ? [[`Driver bata (${totals.driverBataPct}%)`, -totals.driverBata]] : []),
  ];
  return (
    <>
      <section className="panel">
        <SectionTitle icon="▤">Operating expense breakdown</SectionTitle>
        <div className="summary-lines">
          {lines.map(([label, value, type]) => <div className="summary-line" key={label}>
            <span>{label}</span><strong className={type === 'positive' ? 'positive' : type === 'neutral' ? '' : value < 0 ? 'negative' : ''}>{amount(value)}</strong>
          </div>)}
          <div className="summary-line summary-total"><span>Total operating expenses</span><strong>{amount(totals.operatingExpenses)}</strong></div>
        </div>
      </section>
      <section className="profit-card">
        <span className="eyebrow">Net profitability</span>
        <div><span>Net profit <small>(freight less operating expenses)</small></span><strong className={totals.netProfit < 0 ? 'negative' : ''}>{amount(totals.netProfit)}</strong></div>
      </section>
      <section className="panel">
        <SectionTitle icon="%">Driver commission & settlement</SectionTitle>
        <div className="commission-row">
          <Field label="Commission (%)" type="number" min="0" max="100" step="0.5" value={trip.expenses.commissionPct} onChange={(value) => updateExpense('commissionPct', value)} />
          <div className="calculated-field"><span>Calculated commission</span><strong>{amount(totals.commission)}</strong></div>
        </div>
        <div className="payable-row">
          <div><span>Driver advance paid (Gross)</span><strong>{amount(totals.grossDriverAdvance)}</strong></div>
          {totals.dieselDriver > 0 && (
            <div><span>Less: Diesel paid by driver</span><strong className="positive">- {amount(totals.dieselDriver)}</strong></div>
          )}
          {totals.loadingDriver > 0 && (
            <div><span>Less: Loading & unloading paid by driver</span><strong className="positive">- {amount(totals.loadingDriver)}</strong></div>
          )}
          {totals.tollsDriver > 0 && (
            <div><span>Less: Tolls paid by driver</span><strong className="positive">- {amount(totals.tollsDriver)}</strong></div>
          )}
          {totals.policeDriver > 0 && (
            <div><span>Less: Police & RTO paid by driver</span><strong className="positive">- {amount(totals.policeDriver)}</strong></div>
          )}
          {totals.otherDriver > 0 && (
            <div><span>Less: Other expenses paid by driver</span><strong className="positive">- {amount(totals.otherDriver)}</strong></div>
          )}
          {totals.vehicleDriver > 0 && (
            <div><span>Less: Bill expenses paid by driver</span><strong className="positive">- {amount(totals.vehicleDriver)}</strong></div>
          )}
          <div><span>Net advance adjusted</span><strong>{amount(totals.driverAdvance)}</strong></div>
          <div><span>Less: balance payments recorded</span><strong>{amount(totals.driverBalancePaid)}</strong></div>
          <div className="payable-total"><span>Remaining driver balance</span><strong className={totals.finalPayable < 0 ? 'negative' : 'positive'}>{amount(Math.abs(totals.finalPayable))} <small>{totals.finalPayable < 0 ? 'Overpaid' : 'Payable'}</small></strong></div>
        </div>
      </section>
    </>
  );
}

function MetricCard({ label, value, icon, tone = '' }) {
  return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Dashboard({ trips, pending, onCreate, onReports, onEdit, onDelete, onDownload, transporter, pdfLoading }) {
  const freightTotal = useMemo(() => trips.reduce((sum, item) => sum + (item.totals?.freight ?? calculate(item).freight), 0), [trips]);
  const profitTotal = useMemo(() => trips.reduce((sum, item) => sum + (item.totals?.netProfit ?? calculate(item).netProfit), 0), [trips]);
  return (
    <>
      <PageHeading eyebrow={transporter} title="Dashboard" description="A clear view of your trips and freight accounts."
        action={<Button variant="primary" onClick={onCreate}>＋ Create trip</Button>} />
      <div className="metrics-grid">
        <MetricCard label="Total trip sheets" value={trips.length} icon="▤" />
        <MetricCard label="Freight booked" value={amount(freightTotal)} icon="₹" tone="blue" />
        <MetricCard label="Freight pending" value={amount(pending)} icon="◷" tone="amber" />
        <MetricCard label="Net profit" value={amount(profitTotal)} icon="↗" tone="green" />
      </div>
      <section className="panel recent-panel">
        <SectionTitle icon="◷" action={<Button onClick={onReports}>View all trips →</Button>}>Recent trips</SectionTitle>
        {trips.length ? <div className="recent-list">{trips.slice(0, 5).map((item) =>
          <TripListRow key={item.id} trip={item} onEdit={onEdit} onDelete={onDelete} onDownload={onDownload} pdfLoading={pdfLoading} />)}</div>
          : <EmptyState title="No trips recorded yet" text="Create a trip sheet to track freight, expenses and driver settlements." action={<Button variant="primary" onClick={onCreate}>Create your first trip</Button>} />}
      </section>
    </>
  );
}

function Reports({ trips, pending, onCreate, onEdit, onDelete, onDownload, transporter, pdfLoading }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => trips.filter((trip) => `${trip.tripNumber} ${trip.driver} ${trip.truck}`.toLowerCase().includes(query.toLowerCase())), [trips, query]);
  return (
    <>
      <PageHeading eyebrow={transporter} title="Saved trips" description="Review trip sheets, freight collection and settlements."
        action={<Button variant="primary" onClick={onCreate}>＋ New trip</Button>} />
      <div className="metrics-grid two-metrics">
        <MetricCard label="Saved trip sheets" value={trips.length} icon="▤" />
        <MetricCard label="Pending freight" value={amount(pending)} icon="◷" tone="amber" />
      </div>
      <section className="panel">
        <div className="report-toolbar"><SectionTitle icon="▣">Trip ledger</SectionTitle>
          <label className="search-field"><span>⌕</span><input aria-label="Search trips" placeholder="Search trips or drivers" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        {filtered.length ? <div className="recent-list">{filtered.map((trip) =>
          <TripListRow key={trip.id} trip={trip} onEdit={onEdit} onDelete={onDelete} onDownload={onDownload} pdfLoading={pdfLoading} />)}</div>
          : <EmptyState title={query ? 'No matching trips' : 'No saved trip sheets'} text={query ? 'Try another trip number, driver or vehicle.' : 'Save a trip sheet and it will appear here.'} action={!query && <Button variant="primary" onClick={onCreate}>Create trip</Button>} />}
      </section>
    </>
  );
}

function TripListRow({ trip, onEdit, onDelete, onDownload, pdfLoading }) {
  // Always calculate to ensure all fields (totalKm, mileage, totalLitres) are present and fresh
  const totals = calculate(trip);
  const days = calculateDays(trip.startDate, trip.endDate);
  const hasRoute = trip.startPlace || trip.endPlace;
  const km = number(totals.totalKm) || Math.max(0, number(trip.endKm) - number(trip.startKm));
  const mileage = number(totals.mileage);
  const litres = number(totals.totalLitres);
  return (
    <article className="trip-list-row">
      <div className="trip-identity">
        <div className="trip-avatar"><Icon>↗</Icon></div>
        <div>
          <strong>{trip.tripNumber || 'Untitled trip'}</strong>
          <span>{trip.truck || 'No vehicle'} · {trip.driver || 'No driver'}</span>
          {hasRoute && (
            <span className="trip-route-badge">
              📍 {trip.startPlace || 'Origin'} ➔ {trip.endPlace || 'Destination'}
            </span>
          )}
          <span className="trip-dates-km-row">
            <span>{trip.startDate || 'No start date'}{trip.endDate ? ` – ${trip.endDate}` : ''}{days > 0 ? ` (${days} ${days === 1 ? 'day' : 'days'})` : ''}</span>
            {km > 0 && <span className="trip-distance-chip">{km.toLocaleString('en-IN')} KM</span>}
            {mileage > 0 && (
              <span className="trip-mileage-chip" title="Overall fuel mileage based on KM and diesel consumed">
                ⚡ {mileage} KM/L ({litres} L)
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="trip-value"><span>Freight</span><strong>{amount(totals.freight)}</strong></div>
      <div className="trip-value"><span>Pending</span><strong className={totals.pending ? 'negative' : 'positive'}>{amount(totals.pending)}</strong></div>
      <span className={`badge ${totals.pending ? 'badge-warning' : 'badge-success'}`}>{totals.pending ? 'Freight pending' : 'Settled'}</span>
      <div className="trip-actions">
        <Button type="button" onClick={() => onEdit(trip)}>Edit</Button>
        {onDelete && <button className="icon-button delete-button" type="button" aria-label={`Delete ${trip.tripNumber}`} onClick={() => onDelete(trip.id)}>×</button>}
        <Button variant="primary" type="button" onClick={() => onDownload(trip)} disabled={pdfLoading}>
          {pdfLoading ? '…' : 'PDF'}
        </Button>
      </div>
    </article>
  );
}

function FreightDetails({ freights, onEdit, onDelete, transporter }) {
  const [status, setStatus] = useState('unsettled');
  const unsettled = freights.filter((freight) => !freight.settled);
  const settled = freights.filter((freight) => freight.settled);
  const visibleFreights = status === 'settled' ? settled : unsettled;
  const pendingAmount = unsettled.reduce((sum, freight) => sum + Math.max(0, (freight.totalLr || number(freight.amount)) - (freight.totalRec ?? number(freight.received))), 0);
  const settledAmount = settled.reduce((sum, freight) => sum + (freight.totalLr || number(freight.amount)), 0);

  return (
    <>
      <PageHeading eyebrow={transporter} title="Freight details" description="Review unsettled and settled freight from your saved trip sheets." />
      <div className="metrics-grid two-metrics">
        <MetricCard label="Unsettled balance" value={amount(pendingAmount)} icon="◷" tone="amber" />
        <MetricCard label="Settled freight" value={amount(settledAmount)} icon="✓" tone="green" />
      </div>
      <section className="panel">
        <div className="freight-status-tabs" role="tablist" aria-label="Freight status">
          <button type="button" role="tab" aria-selected={status === 'unsettled'}
            className={`freight-status-tab ${status === 'unsettled' ? 'selected' : ''}`} onClick={() => setStatus('unsettled')}>
            Unsettled <span>{unsettled.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={status === 'settled'}
            className={`freight-status-tab ${status === 'settled' ? 'selected' : ''}`} onClick={() => setStatus('settled')}>
            Settled <span>{settled.length}</span>
          </button>
        </div>
        {visibleFreights.length ? (
          <div className="freight-detail-list">
            {visibleFreights.map((freight, index) => {
              const lrTotal = freight.totalLr || (number(freight.amount) + number(freight.loadingCharge) + number(freight.unloadingCharge));
              const totalRec = freight.totalRec ?? (number(freight.received) + (freight.balancePayments || []).reduce((s, b) => s + number(b.amount), 0));
              const balance = Math.max(0, lrTotal - totalRec);
              return (
                <article className="freight-detail-card" key={`${freight.tripId}-${freight.id || index}`}>
                  <div className="freight-detail-heading">
                    <div>
                      <strong>{freight.tripNumber || 'Untitled trip'} · LR {String(freight.rowNumber).padStart(2, '0')}</strong>
                      <span>{freight.truck || 'No vehicle'} · {freight.driver || 'No driver'}</span>
                      {freight.transporterName && (
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginTop: '2px' }}>
                          🏢 {freight.transporterName} {freight.transporterNumber ? `(📞 ${freight.transporterNumber})` : ''}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${freight.settled ? 'badge-success' : 'badge-warning'}`}>{freight.settled ? 'Settled' : 'Unsettled'}</span>
                  </div>
                  <div className="freight-detail-route">{freight.from || '—'} <span>→</span> {freight.to || '—'}</div>
                  <div className="freight-detail-meta">
                    <div><span>Material</span><strong>{freight.material || '—'}</strong></div>
                    <div><span>Tons</span><strong>{freight.weight ? `${freight.weight} t` : '—'}</strong></div>
                    <div><span>Freight</span><strong>{amount(freight.amount)}</strong></div>
                    {(number(freight.loadingCharge) > 0 || number(freight.unloadingCharge) > 0) && (
                      <div><span>Load/Unload</span><strong>{amount(number(freight.loadingCharge) + number(freight.unloadingCharge))}</strong></div>
                    )}
                    <div>
                      <span>Adv. received</span>
                      <strong style={{ color: '#059669' }}>
                        {amount(freight.received)}
                        {freight.paymentMode ? <small style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>via {freight.paymentMode}</small> : null}
                      </strong>
                    </div>
                    {freight.balancePayments && freight.balancePayments.length > 0 && (
                      <div>
                        <span>Bal. received</span>
                        <strong style={{ color: '#0284c7' }}>
                          {amount(freight.balancePayments.reduce((s, b) => s + number(b.amount), 0))}
                          <small style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>({freight.balancePayments.length} installment{freight.balancePayments.length > 1 ? 's' : ''})</small>
                        </strong>
                      </div>
                    )}
                    <div>
                      <span>Total received</span>
                      <strong style={{ color: '#0f766e' }}>{amount(totalRec)}</strong>
                    </div>
                    <div><span>Pending balance</span><strong className={balance ? 'negative' : 'positive'}>{amount(balance)}</strong></div>
                  </div>
                  {freight.balancePayments && freight.balancePayments.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', margin: '8px 0', fontSize: '11px', border: '1px solid #e2e8f0' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', color: '#475569' }}>Balance payment history:</strong>
                      {freight.balancePayments.map((b, bIdx) => (
                        <div key={b.id || bIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>#{bIdx + 1} {b.date || '—'} ({b.paymentMode || 'Account transfer'}):</span>
                          <strong>{amount(b.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="freight-detail-actions">
                    <Button type="button" onClick={() => onEdit(freight.tripId)}>Edit trip sheet</Button>
                    <button className="icon-button delete-button" type="button" aria-label={`Delete trip ${freight.tripNumber}`}
                      onClick={() => onDelete(freight.tripId)}>×</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={status === 'unsettled' ? 'No unsettled freight' : 'No settled freight'}
            text={freights.length ? `There are no ${status} freight entries.` : 'Save a trip sheet with freight details to see them here.'} />
        )}
      </section>
    </>
  );
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><div className="empty-icon">▤</div><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function Settings({ settings, setSettings, trips, setToast, lockApp }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  const updateSetting = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      writeStorage(SETTINGS_KEY, next);
      setDoc(doc(db, 'settings', 'profile'), next).catch(() => {});
      return next;
    });
  };

  const handlePinChange = (e) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    const actualCurrent = settings.appPin || '2026';
    if (currentPin !== actualCurrent) {
      setPinError('Current Security PIN does not match.');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('New PIN must be 4 to 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and Confirm PIN do not match.');
      return;
    }

    setSettings((current) => {
      const next = { ...current, appPin: newPin };
      writeStorage(SETTINGS_KEY, next);
      setDoc(doc(db, 'settings', 'profile'), next).catch(() => {});
      return next;
    });

    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinSuccess('Security PIN updated successfully and synced to cloud!');
    if (setToast) setToast('Security PIN updated successfully!');
  };

  return (
    <>
      <PageHeading eyebrow="Workspace preferences" title="Settings" description="Company details and app security PIN protection." />

      {/* App Security & PIN Management Panel */}
      <section className="panel settings-panel">
        <SectionTitle icon="🔒">App Security & Login PIN</SectionTitle>
        <div className="pin-settings-container">
          <div className="pin-settings-status">
            <span className="badge badge-success">● Security PIN Protection Active</span>
            <p>Your workspace is locked with a security PIN. Anyone opening this portal must enter the correct PIN to view, create, or modify trip records.</p>
          </div>
          <form className="pin-change-form" onSubmit={handlePinChange}>
            <Field label="Current PIN" type="password" maxLength="6" value={currentPin} onChange={setCurrentPin} placeholder="Enter current PIN (e.g. 2026)" required />
            <Field label="New Security PIN (4-6 digits)" type="password" maxLength="6" value={newPin} onChange={setNewPin} placeholder="Enter new 4-6 digit PIN" required />
            <Field label="Confirm New PIN" type="password" maxLength="6" value={confirmPin} onChange={setConfirmPin} placeholder="Re-enter new PIN" required />
            {pinError && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{pinError}</div>}
            {pinSuccess && <div className="notice notice-success" style={{ gridColumn: '1 / -1' }}>{pinSuccess}</div>}
            <div className="pin-form-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
              <Button variant="primary" type="submit">Update Security PIN</Button>
              {lockApp && <Button type="button" onClick={lockApp}>🔒 Lock Workspace Now</Button>}
            </div>
          </form>
        </div>
      </section>

      <section className="panel settings-panel">
        <SectionTitle icon="⚙">Vetri Velavan Logistics company profile</SectionTitle>
        <div className="company-profile">
          <img className="company-logo" src={`${import.meta.env.BASE_URL}vetri-velavan-logo.jpeg`} alt="Vetri Velavan Logistics logo" />
          <div className="settings-form">
            <Field label="Company name" value={settings.transporter} onChange={(value) => updateSetting('transporter', value)} required />
            <Field label="Tagline" value={settings.tagline} onChange={(value) => updateSetting('tagline', value)} />
            <Field label="Group name" value={settings.groupName} onChange={(value) => updateSetting('groupName', value)} />
            <Field label="Location" value={settings.location} onChange={(value) => updateSetting('location', value)} />
            <Field label="Contact number" value={settings.phone} onChange={(value) => updateSetting('phone', value)} />
            <Field label="Proprietor" value={settings.proprietor} onChange={(value) => updateSetting('proprietor', value)} />
            <Field className="profile-wide" label="Qualifications" value={settings.qualifications}
              onChange={(value) => updateSetting('qualifications', value)} />
            <div className="settings-note profile-wide"><span className="status-dot" />Saved automatically on this device</div>
          </div>
        </div>
      </section>
      <div className="settings-footnote">There are {trips} saved trip sheet{trips === 1 ? '' : 's'} stored in this browser. Clearing browser data will remove locally saved trips.</div>
    </>
  );
}

function Vehicles({ settings, setSettings, setToast }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [error, setError] = useState('');
  const vehicles = Array.isArray(settings.vehicles) ? settings.vehicles : [];

  const addVehicle = (event) => {
    event.preventDefault();
    const number = vehicleNumber.trim().toUpperCase();
    if (!number) {
      setError('Enter a vehicle number.');
      return;
    }
    if (vehicles.some((vehicle) => vehicle.toLowerCase() === number.toLowerCase())) {
      setError('That vehicle number has already been added.');
      return;
    }
    const updatedVehicles = Array.from(new Set([...vehicles, number]));
    const updatedSettings = { ...settings, vehicles: updatedVehicles };
    setSettings(updatedSettings);
    setDoc(doc(db, 'settings', 'profile'), updatedSettings).catch(() => {});
    setVehicleNumber('');
    setError('');
    if (setToast) setToast(`Vehicle ${number} added.`);
  };

  const removeVehicle = (vehicle) => {
    const updatedVehicles = vehicles.filter((item) => item !== vehicle);
    const updatedSettings = { ...settings, vehicles: updatedVehicles };
    setSettings(updatedSettings);
    setDoc(doc(db, 'settings', 'profile'), updatedSettings).catch(() => {});
    if (setToast) setToast(`Vehicle ${vehicle} removed.`);
  };

  return (
    <>
      <PageHeading eyebrow="Fleet" title="My vehicle" description="Add and manage the vehicle numbers available when creating trip sheets." />
      <section className="panel settings-panel">
        <SectionTitle icon="▰">Vehicle numbers</SectionTitle>
        <form className="vehicle-form" onSubmit={addVehicle}>
          <Field label="Vehicle number" value={vehicleNumber} onChange={(value) => setVehicleNumber(value.toUpperCase())} placeholder="e.g. AP 28 TC 5542" required />
          <Button variant="primary" type="submit">＋ Add vehicle</Button>
        </form>
        {error && <div className="vehicle-error" role="alert">{error}</div>}
        <div className="vehicle-list">
          {vehicles.length ? vehicles.map((vehicle) => (
            <div className="vehicle-row" key={vehicle}>
              <span>{vehicle}</span>
              <button className="icon-button delete-button" type="button" aria-label={`Remove vehicle ${vehicle}`}
                onClick={() => removeVehicle(vehicle)}>×</button>
            </div>
          )) : <div className="empty-row">No vehicles added yet. Add a vehicle number to select it on trip sheets.</div>}
        </div>
      </section>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
