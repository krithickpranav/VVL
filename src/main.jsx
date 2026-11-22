import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot } from './firebase';

const STORAGE_KEY = 'logistics-trip-reports-v2';
const SETTINGS_KEY = 'logistics-trip-settings-v1';
const LEGACY_STORAGE_KEY = 'logistics-trip-reports-v1';
const DEFAULT_SETTINGS = {
  transporter: 'VETRI VELAVAN LOGISTICS',
  tagline: 'DELIVERING SUCCESS, EVERY MILE',
  groupName: 'SRI BALAJI TRANSPORTS',
  location: 'SALEM.10',
  phone: '9791404012',
  proprietor: 'SELVAMANIYAN DEVENDRA BABU',
  qualifications: 'B.E-MECH, MBA - Logistics and Supply Chain Management',
  vehicles: [],
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

function freshTrip(existingTrips = [], dateStr = today) {
  const nextNumber = getNextTripNumber(existingTrips, dateStr);
  const isFirstEver = (!existingTrips || existingTrips.length === 0);

  if (isFirstEver) {
    return {
      tripNumber: nextNumber,
      truck: '',
      driver: 'Rajesh Kumar',
      startDate: dateStr || today,
      endDate: dateStr || today,
      startKm: 45210,
      endKm: 46120,
      freights: [
        { id: makeId(), from: 'Hyderabad', to: 'Bangalore', material: 'Steel Coils', weight: 15.5, amount: 32000, received: 1000 },
        { id: makeId(), from: 'Bangalore', to: 'Chennai', material: 'General Cargo', weight: 12, amount: 24000, received: 800 },
      ],
      diesel: [{ id: makeId(), station: 'HP Petrol Pump, Kurnool', date: dateStr || today, litres: 180, paidByOwner: 17100, paidByDriver: '', amount: 17100 }],
      expenses: {
        otherExpenses: [
          { id: makeId(), date: dateStr || today, name: 'Food & meals', paidByOwner: 1500, paidByDriver: '', amount: 1500 },
          { id: makeId(), date: dateStr || today, name: 'Loading / coolie', paidByOwner: 800, paidByDriver: '', amount: 800 },
          { id: makeId(), date: dateStr || today, name: 'Misc. & phone', paidByOwner: 500, paidByDriver: '', amount: 500 },
          { id: makeId(), date: dateStr || today, name: 'Kurnool Checkpost', paidByOwner: 1200, paidByDriver: '', amount: 1200 },
        ],
        tolls: [{ id: makeId(), date: dateStr || today, location: 'Orvakal Toll Plaza', paidByOwner: 1850, paidByDriver: '', amount: 1850 }],
        vehicleExpenses: [],
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
    endDate: dateStr || today,
    startKm: '',
    endKm: '',
    freights: [],
    diesel: [],
    expenses: {
      otherExpenses: [],
      tolls: [],
      vehicleExpenses: [],
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
    .map((row) => ({ ...row, id: row.id || makeId() }));
  const freightTotal = freights.reduce((sum, item) => sum + number(item.amount), 0);
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
      ...(Array.isArray(expenses.checkpoints) ? expenses.checkpoints.map((row) => [row.location || 'RTO & police checkpoint', row.amount, row.date]) : []),
      ...(!Array.isArray(expenses.checkpoints) && number(expenses.rto) ? [['RTO & police checkpoints', expenses.rto]] : []),
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
      vehicleExpenses,
      otherExpenses,
      driverAdvances,
      driverBalancePayments,
      tolls: Array.isArray(expenses.tolls)
        ? expenses.tolls.map((row) => {
          const hasOwner = row.paidByOwner !== undefined && row.paidByOwner !== '';
          const hasDriver = row.paidByDriver !== undefined && row.paidByDriver !== '';
          const paidByOwner = hasOwner ? row.paidByOwner : (hasDriver ? '' : (row.amount ?? ''));
          const paidByDriver = hasDriver ? row.paidByDriver : '';
          return { ...row, id: row.id || makeId(), date: row.date || trip.startDate || today, paidByOwner, paidByDriver };
        })
        : [{
          id: makeId(), date: trip.startDate || today, location: 'FASTag tolls', amount: number(expenses.tolls),
        }],
    },
  };
}

function calculate(trip) {
  const expenses = trip.expenses;
  const freight = trip.freights.reduce((sum, item) => sum + number(item.amount), 0);
  const received = trip.freights.reduce((sum, item) => sum + number(item.received), 0);

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

  const tollsOwner = expenses.tolls.reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum; // driver paid all
    return sum + number(item.amount);
  }, 0);
  const tollsDriver = expenses.tolls.reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const tolls = tollsOwner + tollsDriver;

  const otherOwner = expenses.otherExpenses.reduce((sum, item) => {
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + number(item.amount);
  }, 0);
  const otherDriver = expenses.otherExpenses.reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const otherExpenses = otherOwner + otherDriver;

  const vehicleOwner = expenses.vehicleExpenses.reduce((sum, item) => {
    const base = item.type === 'AdBlue oil refill' ? number(item.litres) * number(item.rate) : number(item.amount);
    if (item.paidByOwner !== undefined && item.paidByOwner !== '') return sum + number(item.paidByOwner);
    if (item.paidByDriver !== undefined && item.paidByDriver !== '') return sum;
    return sum + base;
  }, 0);
  const vehicleDriver = expenses.vehicleExpenses.reduce((sum, item) =>
    (item.paidByDriver !== undefined && item.paidByDriver !== '') ? sum + number(item.paidByDriver) : sum, 0);
  const vehicleExpenses = vehicleOwner + vehicleDriver;

  const grossDriverAdvance = expenses.driverAdvances.reduce((sum, item) => sum + number(item.amount), 0);
  // All driver-paid expenses are subtracted from driver advance
  const totalDriverExpenses = dieselDriver + tollsDriver + otherDriver + vehicleDriver;
  const driverAdvance = grossDriverAdvance - totalDriverExpenses;

  const driverBalancePaid = expenses.driverBalancePayments.reduce((sum, item) => sum + number(item.amount), 0);
  const driverBata = freight * number(expenses.driverBataPct) / 100;

  // Owner-paid portions are operating expenses; driver-paid portions reduce driver advance
  const operatingExpenses = dieselOwner + otherOwner + tollsOwner + vehicleOwner + driverBata;
  const commission = freight * number(expenses.commissionPct) / 100;
  const netProfit = freight - operatingExpenses;
  const finalPayable = commission - driverAdvance - driverBalancePaid;

  return {
    freight,
    received,
    pending: Math.max(0, freight - received),
    diesel: dieselOwner,
    dieselOwner,
    dieselDriver,
    dieselTotal,
    otherExpenses,
    otherOwner,
    otherDriver,
    tolls,
    tollsOwner,
    tollsDriver,
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
          if (['tolls', 'otherExpenses', 'vehicleExpenses'].includes(group)) {
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

  const addRow = useCallback((group) => {
    const blank = {
      id: makeId(),
      ...(group === 'freights'
        ? { from: '', to: '', material: '', weight: '', amount: '', received: '' }
        : group === 'vehicleExpenses'
          ? { date: today, type: 'Tyre puncture', name: '', paidByOwner: '', paidByDriver: '', amount: '', litres: '', rate: '' }
          : group === 'otherExpenses'
            ? { date: today, name: '', paidByOwner: '', paidByDriver: '', amount: '' }
          : group === 'driverAdvances'
            ? { date: today, amount: '' }
            : group === 'driverBalancePayments'
              ? { date: today, amount: '' }
            : { date: today, location: '', paidByOwner: '', paidByDriver: '', amount: '' }),
    };
    if (group === 'diesel') Object.assign(blank, { station: '', litres: '', paidByOwner: '', paidByDriver: '', amount: '' });
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
    const left = 16;
    const pageWidth = doc.internal.pageSize.getWidth();
    const printableWidth = pageWidth - left * 2;
    const inr = (value) => `INR ${number(value).toLocaleString('en-IN')}`;
    const heading = () => {
      doc.addImage(logoData, 'JPEG', left, 9, 42, 22);
      doc.setTextColor(20, 33, 54);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(settings.transporter || DEFAULT_SETTINGS.transporter, left + 48, 13);
      doc.setFontSize(6.5);
      doc.setTextColor(102, 115, 135);
      doc.text(settings.tagline || DEFAULT_SETTINGS.tagline, left + 48, 18);
      doc.text(`A Group of ${settings.groupName || DEFAULT_SETTINGS.groupName}`, left + 48, 22);
      doc.text(`${settings.location || DEFAULT_SETTINGS.location} | ${settings.phone || DEFAULT_SETTINGS.phone}`, left + 48, 26);
      doc.text(`Proprietor: ${settings.proprietor || DEFAULT_SETTINGS.proprietor}`, left + 48, 30);
      doc.text(settings.qualifications || DEFAULT_SETTINGS.qualifications, left + 48, 34, { maxWidth: printableWidth - 48 });
      doc.setFontSize(7);
      doc.text('TRIP SHEET REPORT', left + 48, 41);
      doc.setFontSize(11);
      doc.setTextColor(20, 33, 54);
      doc.text(savedTrip.tripNumber || 'Trip Sheet', pageWidth - left, 41, { align: 'right' });
    };
    const tableHeading = (y) => {
      const widths = [10, 43, 33, 13, 26, 26, 27];
      const labels = ['LR', 'ROUTE', 'MATERIAL', 'TONS', 'FREIGHT', 'RECEIVED', 'PENDING'];
      doc.setFillColor(240, 243, 248);
      doc.rect(left, y - 5, printableWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(79, 91, 109);
      let x = left + 2;
      labels.forEach((label, index) => {
        doc.text(label, x, y);
        x += widths[index];
      });
      doc.setDrawColor(220, 226, 235);
      doc.line(left, y + 3, pageWidth - left, y + 3);
      return widths;
    };

    heading();
    const meta = [
      ['Vehicle', savedTrip.truck || '—'],
      ['Driver', savedTrip.driver || '—'],
      ['Trip dates', `${savedTrip.startDate || '—'} to ${savedTrip.endDate || '—'}`],
      ['Distance', `${Math.max(0, number(savedTrip.endKm) - number(savedTrip.startKm)).toLocaleString('en-IN')} KM`],
    ];
    meta.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = left + column * (printableWidth / 2);
      const y = 48 + row * 15;
      doc.setDrawColor(226, 231, 238);
      doc.roundedRect(x, y, printableWidth / 2 - 4, 12, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(112, 124, 143);
      doc.text(label.toUpperCase(), x + 3, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(33, 47, 68);
      doc.text(String(value), x + 3, y + 9.5, { maxWidth: printableWidth / 2 - 10 });
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 39, 58);
    doc.text('Freight details', left, 82);
    let y = 90;
    const widths = tableHeading(y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    (savedTrip.freights || []).forEach((item, index) => {
      if (y > 265) {
        doc.addPage();
        heading();
        y = 48;
        tableHeading(y);
        y += 11;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }
      const cells = [
        String(index + 1),
        `${item.from || ''} - ${item.to || ''}`,
        item.material || '',
        `${number(item.weight)} t`,
        inr(item.amount),
        inr(item.received),
        inr(Math.max(0, number(item.amount) - number(item.received))),
      ];
      let x = left + 2;
      cells.forEach((cell, cellIndex) => {
        const maxWidth = widths[cellIndex] - 4;
        const text = doc.splitTextToSize(String(cell), maxWidth)[0] || '';
        doc.setTextColor(cellIndex >= 4 ? 35 : 60, cellIndex >= 4 ? 49 : 71, cellIndex >= 4 ? 69 : 91);
        doc.text(text, x, y);
        x += widths[cellIndex];
      });
      doc.setDrawColor(232, 236, 241);
      doc.line(left, y + 4, pageWidth - left, y + 4);
      y += 10;
    });

    if (y > 238) {
      doc.addPage();
      heading();
      y = 48;
    } else {
      y += 8;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 39, 58);
    doc.text('Financial summary', left, y);
    y += 8;
    const summary = [
      ['Freight collection', reportTotals.freight],
      ['Freight received', reportTotals.received],
      ['Freight pending', reportTotals.pending],
      ['Diesel expense (Paid by owner)', reportTotals.dieselOwner],
      ...(reportTotals.dieselDriver > 0 ? [['Diesel paid by driver', reportTotals.dieselDriver]] : []),
      ['Other expenses (Paid by owner)', reportTotals.otherOwner],
      ...(reportTotals.otherDriver > 0 ? [['Other expenses paid by driver', reportTotals.otherDriver]] : []),
      ['Toll expense (Paid by owner)', reportTotals.tollsOwner],
      ...(reportTotals.tollsDriver > 0 ? [['Tolls paid by driver', reportTotals.tollsDriver]] : []),
      ['Bill expenses (Paid by owner)', reportTotals.vehicleOwner],
      ...(reportTotals.vehicleDriver > 0 ? [['Bill expenses paid by driver', reportTotals.vehicleDriver]] : []),
      ...(reportTotals.driverBata > 0 ? [[`Driver bata (${reportTotals.driverBataPct}%)`, reportTotals.driverBata]] : []),
      ['Total operating expenses', reportTotals.operatingExpenses],
      ['Net profit', reportTotals.netProfit],
      ['Driver advance paid (Gross)', reportTotals.grossDriverAdvance],
      ...(reportTotals.dieselDriver > 0 ? [['Less: Diesel paid by driver', -reportTotals.dieselDriver]] : []),
      ...(reportTotals.tollsDriver > 0 ? [['Less: Tolls paid by driver', -reportTotals.tollsDriver]] : []),
      ...(reportTotals.otherDriver > 0 ? [['Less: Other expenses paid by driver', -reportTotals.otherDriver]] : []),
      ...(reportTotals.vehicleDriver > 0 ? [['Less: Bill expenses paid by driver', -reportTotals.vehicleDriver]] : []),
      ['Net driver advance', reportTotals.driverAdvance],
      ['Driver balance paid', reportTotals.driverBalancePaid],
      ['Driver settlement', reportTotals.finalPayable],
    ];
    summary.forEach(([label, value], index) => {
      if (y > 276) {
        doc.addPage();
        heading();
        y = 38;
      }
      const isOperatingTotal = label === 'Total operating expenses';
      const isNetProfit = label === 'Net profit';
      const isSettlement = label === 'Driver settlement';
      const isTotalLine = isOperatingTotal || isNetProfit || isSettlement;

      if (isOperatingTotal) doc.setDrawColor(172, 182, 196);
      else doc.setDrawColor(234, 237, 242);
      doc.line(left, y + 2, pageWidth - left, y + 2);
      doc.setFont('helvetica', isTotalLine ? 'bold' : 'normal');
      doc.setFontSize(isTotalLine ? 9 : 8);
      doc.setTextColor(69, 82, 101);
      doc.text(label, left + 1, y);
      doc.setTextColor(isNetProfit && reportTotals.netProfit >= 0 ? 20 : 69, isNetProfit && reportTotals.netProfit >= 0 ? 120 : 82, isNetProfit && reportTotals.netProfit >= 0 ? 83 : 101);
      doc.text(inr(Math.abs(value)), pageWidth - left - 1, y, { align: 'right' });
      if (isSettlement) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(value < 0 ? 'Recoverable from driver' : 'Payable to driver', pageWidth - left - 1, y + 4, { align: 'right' });
      }
      y += isSettlement ? 10 : 8;
    });

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
  const freightDetails = useMemo(() => sortedTrips.flatMap((savedTrip) => (savedTrip.freights || []).map((freight, index) => ({
    ...freight,
    tripId: savedTrip.id,
    tripNumber: savedTrip.tripNumber,
    truck: savedTrip.truck,
    driver: savedTrip.driver,
    rowNumber: index + 1,
    settled: number(freight.amount) > 0 && number(freight.received) >= number(freight.amount),
  }))), [sortedTrips]);

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
          <span className="avatar">VVL</span>
          <div>
            <strong>Accounts workspace</strong>
            <span>{cloudStatus === 'synced' ? '☁️ Cloud synced' : cloudStatus === 'syncing' ? '⏳ Syncing cloud…' : 'Local + Cloud sync'}</span>
          </div>
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
          </div>
          <div className="topbar-right">
            <span className={`status-dot ${cloudStatus === 'synced' ? 'status-synced' : cloudStatus === 'syncing' ? 'status-syncing' : ''}`} />
            {cloudStatus === 'synced' ? 'Cloud synced ☁️' : cloudStatus === 'syncing' ? 'Syncing to cloud…' : cloudStatus === 'connecting' ? 'Connecting cloud…' : 'Saved locally'}
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
            <Settings settings={settings} setSettings={setSettings} trips={trips.length} />
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

function TripEditor({ trip, totals, step, setStep, updateTrip, updateExpense, updateRow, addRow, removeRow, saveTrip, editing, transporter, vehicles, trips }) {
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
        {step === 0 && <TripDetails trip={trip} updateTrip={updateTrip} totals={totals} addRow={addRow} updateRow={updateRow} removeRow={removeRow} vehicles={vehicles} trips={trips} />}
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

function TripDetails({ trip, updateTrip, totals, addRow, updateRow, removeRow, vehicles, trips }) {
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
          <div className="field-pair">
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
            <Field label="End date" type="date" value={trip.endDate} onChange={(value) => updateTrip('endDate', value)} />
          </div>
        </div>
        <div className="odometer-row">
          <Field label="Start KM" type="number" min="0" value={trip.startKm} onChange={(value) => updateTrip('startKm', value)} />
          <Field label="End KM" type="number" min="0" value={trip.endKm} onChange={(value) => updateTrip('endKm', value)} />
          <div className="odometer-total"><span>Total distance</span><strong>{Math.max(0, number(trip.endKm) - number(trip.startKm)).toLocaleString('en-IN')} <small>KM</small></strong></div>
        </div>
      </section>

      <section className="panel">
        <SectionTitle icon="▣" action={<Button variant="primary" type="button" onClick={() => addRow('freights')}>＋ Add LR</Button>}>Freight details</SectionTitle>
        <div className="data-grid freight-grid">
          <div className="data-header"><span>LR</span><span>From</span><span>To</span><span>Material</span><span>Tons</span><span>Freight (₹)</span><span>Received (₹)</span><span /></div>
          {trip.freights.map((row, index) => (
              <div className="data-row" key={row.id}>
                <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                <InlineInput label="From" value={row.from} onChange={(value) => updateRow('freights', row.id, 'from', value)} />
                <InlineInput label="To" value={row.to} onChange={(value) => updateRow('freights', row.id, 'to', value)} />
                <InlineInput label="Material" value={row.material} onChange={(value) => updateRow('freights', row.id, 'material', value)} />
                <InlineInput label="Tons" type="number" min="0" step="0.1" value={row.weight} onChange={(value) => updateRow('freights', row.id, 'weight', value)} />
                <InlineInput label="Freight (₹)" type="number" min="0" value={row.amount} onChange={(value) => updateRow('freights', row.id, 'amount', value)} />
                <InlineInput label="Received (₹)" type="number" min="0" value={row.received} onChange={(value) => updateRow('freights', row.id, 'received', value)} />
                <button className="icon-button row-delete" type="button" onClick={() => removeRow('freights', row.id)} aria-label={`Remove freight row ${index + 1}`}>×</button>
              </div>
          ))}
          {trip.freights.length === 0 && <div className="empty-row">No freight entries yet. Select “Add LR” to start.</div>}
        </div>
        <div className="total-strip"><span>Total freight collection</span><strong>{amount(totals.freight)}</strong></div>
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
        </div>
      </section>
      <section className="panel">
        <SectionTitle icon="₹">Toll expense</SectionTitle>
        <RepeatableEntries title="FASTag toll logs" rows={trip.expenses.tolls} group="tolls"
          updateRow={updateRow} addRow={addRow} removeRow={removeRow} locationLabel="Plaza / location" />
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
        {totals.tollsDriver > 0 && (
          <div className="driver-advance-adjustment">
            <span>Less: Tolls paid by driver (subtracted from advance)</span>
            <strong className="positive">- {amount(totals.tollsDriver)}</strong>
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
          <span>Balance payable after recorded payments</span>
          <strong className={totals.finalPayable < 0 ? 'negative' : 'positive'}>{amount(Math.abs(totals.finalPayable))}</strong>
          <small>{totals.finalPayable < 0 ? 'Overpaid' : 'Remaining to pay'}</small>
        </div>
      </section>
    </>
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

function RepeatableEntries({ title, rows, group, updateRow, addRow, removeRow, locationLabel }) {
  const ownerTotal = rows.reduce((sum, row) => {
    if (row.paidByOwner !== undefined && row.paidByOwner !== '') return sum + number(row.paidByOwner);
    if (row.paidByDriver !== undefined && row.paidByDriver !== '') return sum;
    return sum + number(row.amount);
  }, 0);
  const driverTotal = rows.reduce((sum, row) =>
    (row.paidByDriver !== undefined && row.paidByDriver !== '') ? sum + number(row.paidByDriver) : sum, 0);
  return (
    <div className="repeatable-block">
      <div className="repeatable-heading"><strong>{title}</strong><Button type="button" onClick={() => addRow(group)}>＋ Add entry</Button></div>
      {rows.map((row, index) => (
        <div className="repeatable-row expense-split-card" key={row.id}>
          <Field label="Date" type="date" value={row.date} onChange={(value) => updateRow(group, row.id, 'date', value)} />
          <Field label={locationLabel} value={row.location} onChange={(value) => updateRow(group, row.id, 'location', value)} />
          <Field label="Paid by owner (₹)" type="number" min="0" value={row.paidByOwner ?? ''} onChange={(value) => updateRow(group, row.id, 'paidByOwner', value)} placeholder="0" />
          <Field label="Paid by driver (₹)" type="number" min="0" value={row.paidByDriver ?? ''} onChange={(value) => updateRow(group, row.id, 'paidByDriver', value)} placeholder="0" />
          <div className="entry-rate"><span>Total</span><strong>{amount(number(row.paidByOwner) + number(row.paidByDriver) || number(row.amount))}</strong></div>
          <button className="icon-button row-delete" type="button" onClick={() => removeRow(group, row.id)} aria-label={`Remove ${title} entry ${index + 1}`}>×</button>
        </div>
      ))}
      <div className="total-strip diesel-summary-strip">
        <div><span>Paid by owner (expense): </span><strong>{amount(ownerTotal)}</strong></div>
        <div><span>Paid by driver (less advance): </span><strong>{amount(driverTotal)}</strong></div>
        <div><span>Total tolls: </span><strong>{amount(ownerTotal + driverTotal)}</strong></div>
      </div>
    </div>
  );
}

function Settlement({ trip, totals, updateExpense }) {
  const lines = [
    ['Freight collection', totals.freight, 'positive'],
    ['Diesel expense (Paid by owner)', -totals.dieselOwner],
    ...(totals.dieselDriver > 0 ? [['Diesel paid by driver (adjusted in advance)', -totals.dieselDriver, 'neutral']] : []),
    ['Other expenses (Paid by owner)', -totals.otherOwner],
    ...(totals.otherDriver > 0 ? [['Other expenses paid by driver (adjusted in advance)', -totals.otherDriver, 'neutral']] : []),
    ['Toll expense (Paid by owner)', -totals.tollsOwner],
    ...(totals.tollsDriver > 0 ? [['Tolls paid by driver (adjusted in advance)', -totals.tollsDriver, 'neutral']] : []),
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
          {totals.tollsDriver > 0 && (
            <div><span>Less: Tolls paid by driver</span><strong className="positive">- {amount(totals.tollsDriver)}</strong></div>
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
  // Use pre-computed totals if available (saved on trip), else recalculate
  const totals = trip.totals && trip.totals.freight !== undefined ? trip.totals : calculate(trip);
  return (
    <article className="trip-list-row">
      <div className="trip-identity">
        <div className="trip-avatar"><Icon>↗</Icon></div>
        <div><strong>{trip.tripNumber || 'Untitled trip'}</strong><span>{trip.truck || 'No vehicle'} · {trip.driver || 'No driver'}</span>
          <span>{trip.startDate || 'No start date'}{trip.endDate ? ` – ${trip.endDate}` : ''}</span></div>
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
  const pendingAmount = unsettled.reduce((sum, freight) => sum + Math.max(0, number(freight.amount) - number(freight.received)), 0);
  const settledAmount = settled.reduce((sum, freight) => sum + number(freight.amount), 0);

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
              const balance = Math.max(0, number(freight.amount) - number(freight.received));
              return (
                <article className="freight-detail-card" key={`${freight.tripId}-${freight.id || index}`}>
                  <div className="freight-detail-heading">
                    <div><strong>{freight.tripNumber || 'Untitled trip'} · LR {String(freight.rowNumber).padStart(2, '0')}</strong>
                      <span>{freight.truck || 'No vehicle'} · {freight.driver || 'No driver'}</span></div>
                    <span className={`badge ${freight.settled ? 'badge-success' : 'badge-warning'}`}>{freight.settled ? 'Settled' : 'Unsettled'}</span>
                  </div>
                  <div className="freight-detail-route">{freight.from || '—'} <span>→</span> {freight.to || '—'}</div>
                  <div className="freight-detail-meta">
                    <div><span>Material</span><strong>{freight.material || '—'}</strong></div>
                    <div><span>Tons</span><strong>{freight.weight || '—'}</strong></div>
                    <div><span>Freight</span><strong>{amount(freight.amount)}</strong></div>
                    <div><span>Received</span><strong>{amount(freight.received)}</strong></div>
                    <div><span>Balance</span><strong className={balance ? 'negative' : 'positive'}>{amount(balance)}</strong></div>
                  </div>
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

function Settings({ settings, setSettings, trips }) {
  const updateSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageHeading eyebrow="Workspace preferences" title="Settings" description="Company details appear throughout the app and on trip sheet PDFs." />
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
