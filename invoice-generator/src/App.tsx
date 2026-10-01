import { useState, useMemo } from 'react';
import { FiPlus, FiTrash2, FiInfo, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

// Types
type ProductType = 'One time' | 'Recurring' | 'DR (Daily)';
type AmountType = 'Amount' | 'Percentage';

interface Item {
  id: string;
  name: string;
  type: ProductType;
  price: string;
  bt: AmountType;
  bv: string;
  qty: string;
  ds: string;
  de: string;
  at: AmountType;
  av: string;
  so: string;
}

interface State {
  start: string;
  end: string;
  freq: 'Monthly' | 'Quarterly' | 'Semester' | 'Yearly';
  cyc: string;
  tx: string;
  dx: string;
  xn: string;
  xr: string;
  items: Item[];
}

// Helpers
const r9 = (x: number) => Math.round(x);
const f9 = (x: number) => Number(x.toFixed(9));
const fmt = (v: any) => v === '' || v == null ? '' : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 9 }) : v;

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fd = (o: { y: number; m: number; d: number }) => String(o.d).padStart(2, '0') + '-' + MN[o.m - 1] + '-' + o.y;
const adj = (d: number) => [28, 29, 31].includes(d) ? 30 : d;
const P = (s: string) => { const [a, b, c] = s.replace(/\//g, '-').split('-').map(Number); return { y: a || 2000, m: b || 1, d: c || 1 }; };
const ser = (o: { y: number; m: number; d: number }) => Date.UTC(o.y, o.m - 1, o.d) / 864e5;
const fromSer = (n: number) => { const t = new Date(n * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addM = (o: { y: number; m: number; d: number }, n: number) => { const t = o.y * 12 + o.m - 1 + n, y = Math.floor(t / 12), m = t % 12 + 1; return { y, m, d: Math.min(o.d, dim(y, m)) }; };
const mk = (y: number, m: number, d: number) => { const t = y * 12 + m - 1; return { y: Math.floor(t / 12), m: t % 12 + 1, d }; };
const days = (s: any, e: any) => (e.y - s.y) * 360 + (e.m - s.m) * 30 + adj(e.d) - adj(s.d) + 1;

const TY: ProductType[] = ['One time', 'Recurring', 'DR (Daily)'];
const AM: AmountType[] = ['Amount', 'Percentage'];
const FREQ: State['freq'][] = ['Monthly', 'Quarterly', 'Semester', 'Yearly'];

const initialItems: Item[] = [
  { id: '1', name: 'One-time product A', type: 'One time', price: '1850', bt: 'Amount', bv: '213', qty: '2', ds: '', de: '', at: 'Amount', av: '332', so: '2942' },
  { id: '2', name: 'One-time product B', type: 'One time', price: '100000', bt: 'Amount', bv: '5555', qty: '2', ds: '', de: '', at: 'Amount', av: '21005', so: '167885' },
  { id: '3', name: 'Recurring product A', type: 'Recurring', price: '1850', bt: 'Amount', bv: '213', qty: '2', ds: '', de: '', at: 'Amount', av: '370', so: '16000' },
  { id: '4', name: 'Recurring product B', type: 'Recurring', price: '100000', bt: 'Amount', bv: '9999', qty: '2', ds: '', de: '', at: 'Amount', av: '110251', so: '789759' },
  { id: '5', name: 'DR product A', type: 'DR (Daily)', price: '1850', bt: 'Amount', bv: '18', qty: '2', ds: '2026-03-25', de: '2026-04-05', at: 'Amount', av: '992', so: '42976' },
  { id: '6', name: 'DR product B', type: 'DR (Daily)', price: '12345', bt: 'Amount', bv: '345', qty: '2', ds: '2026-03-25', de: '2026-04-05', at: 'Amount', av: '8726', so: '279274' }
];

function calculate(S: State) {
  const W: string[] = [];
  const st = P(S.start || '2000-01-01');
  const en = P(S.end || '2000-01-01');
  const mpiMap: Record<string, number> = { Monthly: 1, Quarterly: 3, Semester: 6, Yearly: 12 };
  const mpi = mpiMap[S.freq] || 1;
  const cyc = +S.cyc || 0;
  const bad = ser(st) > ser(en);

  if (bad) W.push('Start is after end');
  if (!cyc && st.d > 28) W.push('Start on the 29th-31st without a cycle day: enter a cycle day 1-28');

  const dur = bad ? 0 : f9(days(st, en) / 30);
  const per: any[] = [];

  for (let k = 1; k <= 25 && !bad; k++) {
    let s = st;
    if (k > 1) {
      const pe = ser(per[k - 2].e);
      if (pe >= ser(en)) break;
      s = fromSer(pe + 1);
    }
    const nx = !cyc ? addM(st, mpi * k) : s.d === cyc ? addM(s, mpi) : s.d < cyc ? mk(s.y, s.m, cyc) : mk(s.y, s.m + 1, cyc);
    const e = fromSer(Math.min(ser(en), ser(nx) - 1));
    const dd = days(s, e);
    per.push({ s, e, days: dd, f: f9(dd / 30), last: ser(e) === ser(en) });
  }

  if (per.length && ser(per[per.length - 1].e) < ser(en)) W.push('More than 25 invoices needed (max 25)');

  const all = S.items.map((x, idx) => {
    const used = x.price !== '';
    const it: any = { used, name: x.name, type: x.type, so: x.so, ds: x.ds, de: x.de, origIndex: idx };
    if (!used) return it;

    const price = r9(+x.price || 0);
    const qty = +x.qty || 0;
    const bv = +x.bv || 0;
    const av = +x.av || 0;
    const pb = x.bt === 'Percentage';

    let drDays = 0;
    if (x.type === 'DR (Daily)' && x.ds && x.de) {
      const d1 = P(x.ds);
      const d2 = P(x.de);
      drDays = Math.max(0, days(d1, d2));
    }

    const bd = pb ? r9(price * bv / 100) : r9(bv);
    const net = r9(price - bd);
    const d = x.type === 'Recurring' ? dur : x.type === 'One time' ? 1 : drDays;
    const tt = r9(net * qty * d);
    const ad = x.at === 'Percentage' ? r9(tt * av / 100) : r9(av);

    return Object.assign(it, {
      price, qty, bd, net, dur: d, tt, ad,
      gt: r9(tt - ad), pct: pb ? bv / 100 : price ? bv / price : 0
    });
  });

  const its = all.filter(i => i.used);

  its.forEach(it => {
    it.rows = [];
    let cT = 0, cA = 0;
    let targetK = 0;

    if (it.type === 'DR (Daily)' && it.ds) {
      const drs = ser(P(it.ds));
      targetK = per.findIndex(p => ser(p.s) <= drs && drs <= ser(p.e));
      if (targetK === -1) targetK = drs < ser(per[0].s) ? 0 : per.length - 1;
    }

    per.forEach((p, k) => {
      let tt = 0, ad = 0, pr: any = '', dc: any = '', nt: any = '';
      if (it.type === 'Recurring') {
        if (it.dur) {
          if (p.last) {
            tt = r9(it.tt - cT);
            ad = r9(it.ad - cA);
          } else {
            tt = r9(it.tt * p.f / it.dur);
            ad = r9(it.ad * p.f / it.dur);
          }
          nt = r9(it.qty ? tt / it.qty : 0);
          pr = it.pct >= 1 ? 0 : r9(nt / (1 - it.pct));
          dc = r9(pr - nt);
        }
        cT = r9(cT + tt);
        cA = r9(cA + ad);
      } else if ((it.type === 'One time' && k === 0) || (it.type === 'DR (Daily)' && k === targetK)) {
        tt = it.tt;
        ad = it.ad;
        pr = it.price;
        dc = it.bd;
        nt = it.net;
      }
      it.rows.push({ pr, dc, nt, tt, ad, gt: r9(tt - ad) });
    });
  });

  const sb = (t: string, f: (i: any) => number) => r9(its.filter(i => i.type === t).reduce((a, i) => a + f(i), 0));
  const ppn = (+S.tx || 0) / 100;
  const pph = (+S.dx || 0) / 100;

  const fin = (o: any) => {
    o.pre = r9(o.one + o.rec + o.dr);
    o.tax = Math.trunc(o.pre * ppn);
    o.ded = Math.trunc(o.pre * pph);
    o.grand = o.pre + o.tax - o.ded;
    return o;
  };

  const so = fin({ one: sb('One time', i => i.gt), rec: sb('Recurring', i => i.gt), dr: sb('DR (Daily)', i => i.gt) });

  const cols: any[] = [];
  per.forEach((p, k) => {
    cols.push(Object.assign(
      fin({
        one: sb('One time', i => i.rows[k].gt),
        rec: sb('Recurring', i => i.rows[k].gt),
        dr: sb('DR (Daily)', i => i.rows[k].gt)
      }),
      { label: 'INV ' + (k + 1), p }
    ));
  });

  return { W, dur, mpi, per, all, its, so, cols };
}

const DateInput = ({ value, onChange, className, style }: any) => {
  return (
    <div className="relative flex items-center" style={style}>
      <input 
        type="text" 
        placeholder="YYYY-MM-DD" 
        className={className + " pr-10"} 
        value={value} 
        onChange={onChange} 
      />
      <input 
        type="date"
        className="absolute right-0 w-8 h-full opacity-0 cursor-pointer"
        title="Pilih dari Kalender"
        onChange={onChange}
        value={value.replace(/\//g, '-').match(/^\d{4}-\d{2}-\d{2}$/) ? value.replace(/\//g, '-') : ''}
      />
      <div className="absolute right-2.5 pointer-events-none text-gray-500">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
    </div>
  );
};

const Input = ({ label, children, note }: any) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    {note && <span className="text-[11px] text-gray-400">{note}</span>}
    {children}
  </div>
);

export default function App() {
  const [state, setState] = useState<State>({
    start: '2026-01-01',
    end: '2026-05-31',
    freq: 'Monthly',
    cyc: '20',
    tx: '11',
    dx: '2',
    xn: '',
    xr: '1',
    items: initialItems,
  });

  const R = useMemo(() => calculate(state), [state]);
  
  // Post-calculate checks
  const W = [...R.W];
  
  // Additional warnings based on items
  R.all.forEach((it, i) => {
    if (it.used && it.so !== '') {
      const d = r9(it.gt - (+it.so || 0));
      if (Math.abs(d) >= 1e-6) {
        W.push(`${it.name || 'Item ' + (i + 1)}: total differs from Grand total in SO by ${fmt(d)}`);
      }
    }
  });

  const XN = state.xn ? ` (${state.xn})` : '';
  const cvt = (r: any) => {
    if (r.isCur) r.v = r.v.map((v: any, i: number) => i > 0 && typeof v === 'number' ? r9(v * (+state.xr || 1)) : v);
    return r;
  };
  
  const vr = (l: string, k: string, c: string = '') => {
    const t = r9(R.cols.reduce((a, x) => a + x[k], 0));
    return cvt({ c, isCur: true, v: [l + XN, R.so[k], t, r9(t - R.so[k]), ...R.cols.map(x => x[k])] });
  };
  const pr = (l: string, f: (p: any) => any) => ({ v: [l, '', '', '', ...R.cols.map(c => c.p ? f(c.p) : '')] });

  const rs_raw = [
    pr('Period start', p => fd(p.s)),
    pr('Period end', p => fd(p.e)),
    pr('Days (30/360)', p => p.days),
    pr('Pro-rata factor (days / 30)', p => p.f),
    vr('One time total', 'one'),
    vr('Recurring total', 'rec'),
    vr('DR (Daily) total', 'dr'),
    vr('Pre-tax total', 'pre', 'font-medium bg-gray-50 border-t border-b border-gray-100'),
    vr('Taxes and charges', 'tax'),
    vr('Deducted taxes', 'ded'),
    vr('Invoice grand total', 'grand', 'font-semibold bg-gray-100')
  ];

  const dP = r9(rs_raw[7].v[3] as number);
  if (R.cols.length && Math.abs(dP) >= 1e-6) W.push('Pre-tax of invoices differs from SO by ' + fmt(dP));
  if (R.cols.some(c => c.grand < 0)) W.push('An invoice has a negative amount: check dates and durations');

  const updateParam = (field: keyof State, value: string) => {
    setState({ ...state, [field]: value });
  };

  const updateItem = (index: number, field: keyof Item, value: string) => {
    const newItems = [...state.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setState({ ...state, items: newItems });
  };

  const addItem = () => {
    setState({
      ...state,
      items: [...state.items, {
        id: Math.random().toString(36).slice(2, 9),
        name: '', type: 'Recurring', price: '', bt: 'Amount', bv: '', qty: '1', ds: '', de: '', at: 'Amount', av: '', so: ''
      }]
    });
  };

  const removeItem = (index: number) => {
    setState({
      ...state,
      items: state.items.filter((_, i) => i !== index)
    });
  };

  const inputClass = "bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none transition text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full placeholder-gray-300 hover:border-gray-300";
  const selectClass = "bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none transition text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full hover:border-gray-300 cursor-pointer";

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans text-gray-900 selection:bg-gray-200">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="mb-8 border-b border-gray-200 pb-6 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mb-2">
              Invoice Calculator
            </h1>
            <p className="text-gray-500 text-sm flex items-center justify-center md:justify-start gap-1.5 font-normal">
              <FiInfo className="shrink-0" />
              <span>Generate schedules from Sales Orders for One-time, Recurring, and DR products.</span>
            </p>
          </div>
        </header>

        {/* Parameters */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-medium mb-6 text-gray-800 flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">1</span>
            Global Parameters
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            <Input label="Start Subscription">
              <DateInput className={inputClass} value={state.start} onChange={(e: any) => updateParam('start', e.target.value)} />
            </Input>
            <Input label="End Subscription">
              <DateInput className={inputClass} value={state.end} onChange={(e: any) => updateParam('end', e.target.value)} />
            </Input>
            <Input label="Billing Period">
              <select className={selectClass} value={state.freq} onChange={e => updateParam('freq', e.target.value as any)}>
                {FREQ.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Input>
            <Input label="Invoice Cycle Day" note="Blank = follows start date">
              <input type="text" inputMode="decimal" className={inputClass} value={state.cyc} onChange={e => updateParam('cyc', e.target.value)} placeholder="e.g. 20" />
            </Input>
            <Input label="Taxes & Charges (%)">
              <input type="text" inputMode="decimal" className={inputClass} value={state.tx} onChange={e => updateParam('tx', e.target.value)} />
            </Input>
            <Input label="Deducted Taxes (%)">
              <input type="text" inputMode="decimal" className={inputClass} value={state.dx} onChange={e => updateParam('dx', e.target.value)} />
            </Input>
            <Input label="Target Currency">
              <input type="text" className={inputClass} value={state.xn} onChange={e => updateParam('xn', e.target.value)} placeholder="e.g. IDR" />
            </Input>
            <Input label="Exchange Rate">
              <input type="text" inputMode="decimal" className={inputClass} value={state.xr} onChange={e => updateParam('xr', e.target.value)} />
            </Input>
          </div>
          
          <div className="mt-8 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 inline-flex items-center text-sm text-gray-600 font-medium">
            {`Recurring duration: ${fmt(R.dur)} months • ${R.mpi} month(s) per invoice • ${R.per.length} invoice(s)`}
          </div>
        </section>

        {/* Products */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-medium mb-6 text-gray-800 flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">2</span>
            Products List
          </h2>
          
          <div className="overflow-x-auto border border-gray-200 rounded-xl mb-6 shadow-sm">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5 font-medium">Product Name</th>
                  <th className="px-4 py-3.5 font-medium min-w-[130px]">Type</th>
                  <th className="px-4 py-3.5 font-medium">Price / unit</th>
                  <th className="px-4 py-3.5 font-medium min-w-[170px]">Basic Discount</th>
                  <th className="px-4 py-3.5 font-medium w-24">Qty</th>
                  <th className="px-4 py-3.5 font-medium min-w-[140px]">DR Date Range</th>
                  <th className="px-4 py-3.5 font-medium min-w-[170px]">Addt'l Discount</th>
                  <th className="px-4 py-3.5 font-medium">SO Grand Total</th>
                  <th className="px-4 py-3.5 font-medium text-right">Calc. Total</th>
                  <th className="px-4 py-3.5 font-medium text-center">Status</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.items.map((it, i) => {
                  const calculated = R.all[i];
                  const hasDiff = calculated?.used && calculated.so !== '' && Math.abs(r9(calculated.gt - (+calculated.so || 0))) >= 1e-6;
                  const diffVal = calculated?.used ? r9(calculated.gt - (+calculated.so || 0)) : 0;
                  
                  return (
                    <tr key={it.id} className="bg-white hover:bg-gray-50/50 transition-colors group">
                      <td className="px-3 py-3">
                        <input className={inputClass} value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Name" />
                      </td>
                      <td className="px-3 py-3">
                        <select className={selectClass} value={it.type} onChange={e => updateItem(i, 'type', e.target.value as any)}>
                          {TY.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" inputMode="decimal" className={inputClass} value={it.price} onChange={e => updateItem(i, 'price', e.target.value)} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select className={selectClass + " !px-2 w-[70px]"} value={it.bt} onChange={e => updateItem(i, 'bt', e.target.value as any)}>
                            {AM.map(a => <option key={a} value={a}>{a === 'Amount' ? '$' : '%'}</option>)}
                          </select>
                          <input type="text" inputMode="decimal" className={inputClass + " w-[90px]"} value={it.bv} onChange={e => updateItem(i, 'bv', e.target.value)} placeholder={it.bt === 'Percentage' ? '%' : 'Amt'} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" inputMode="decimal" className={inputClass} value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <DateInput className={inputClass + " !py-1 text-[13px]"} value={it.ds} onChange={(e: any) => updateItem(i, 'ds', e.target.value)} style={{ width: '130px' }} />
                          <DateInput className={inputClass + " !py-1 text-[13px]"} value={it.de} onChange={(e: any) => updateItem(i, 'de', e.target.value)} style={{ width: '130px' }} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select className={selectClass + " !px-2 w-[70px]"} value={it.at} onChange={e => updateItem(i, 'at', e.target.value as any)}>
                            {AM.map(a => <option key={a} value={a}>{a === 'Amount' ? '$' : '%'}</option>)}
                          </select>
                          <input type="text" inputMode="decimal" className={inputClass + " w-[90px]"} value={it.av} onChange={e => updateItem(i, 'av', e.target.value)} placeholder={it.at === 'Percentage' ? '%' : 'Amt'} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" inputMode="decimal" className={inputClass} value={it.so} onChange={e => updateItem(i, 'so', e.target.value)} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                        {calculated?.used ? fmt(calculated.gt) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {calculated?.used && it.so !== '' && (
                          hasDiff ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-black text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                              DIFF {fmt(diffVal)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              <FiCheckCircle className="text-gray-400" /> OK
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-lg transition-colors" title="Remove Item">
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <button onClick={addItem} className="inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-sm transition font-medium text-sm w-full sm:w-auto">
            <FiPlus size={16} /> Add Product
          </button>
          
          <p className="mt-6 text-xs text-gray-400 flex gap-2 font-normal">
            <FiInfo className="shrink-0 mt-0.5" />
            <span>Recurring duration is automatic from start/end. One time = billed in INV 1. DR = price × qty × days. Rows without a price are ignored.</span>
          </p>
        </section>

        {/* Results */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-10">
          <h2 className="text-lg font-medium mb-6 text-gray-800 flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">3</span>
            Invoices Breakdown
          </h2>
          
          {W.length > 0 ? (
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3 text-gray-800">
                <FiAlertCircle className="mt-0.5 shrink-0" size={18} />
                <div className="flex flex-col gap-1.5">
                  {W.map((w, idx) => <span key={idx} className="text-sm">{w}</span>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-600 flex items-center gap-2 text-sm font-medium">
              <FiCheckCircle size={18} /> All invoices match the Sales Order amounts perfectly.
            </div>
          )}

          {R.cols.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl mb-8 shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 sticky left-0 bg-gray-50 z-10 w-48 font-medium">Description</th>
                    <th className="px-5 py-4 text-right font-medium">SO Value</th>
                    <th className="px-5 py-4 text-right font-medium">Invoice Total</th>
                    <th className="px-5 py-4 text-right font-medium">Difference</th>
                    {R.cols.map(c => <th key={c.label} className="px-5 py-4 text-right font-medium text-gray-900">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rs_raw.map(cvt).map((row: any, i: number) => (
                    <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${row.c || ''}`}>
                      {row.v.map((val: any, j: number) => (
                        <td key={j} className={`px-5 py-3.5 ${j === 0 ? 'sticky left-0 bg-white z-10 font-medium text-gray-700' : 'text-right font-mono text-gray-600'}`}>
                          {fmt(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300 font-medium text-sm">
              Enter valid dates and at least one product with a price to see the invoice breakdown.
            </div>
          )}

          {/* Details per Product */}
          {R.cols.length > 0 && R.its.length > 0 && (
            <div className="mt-10 space-y-4">
              <h3 className="text-base font-medium text-gray-800 mb-5">Product Level Breakdown</h3>
              
              {R.its.map((it: any, idx: number) => {
                const g = (k: string) => R.cols.map(c => it.rows[R.cols.indexOf(c)][k]);
                const L = [
                  ['Price per unit', 'pr', 'price'],
                  ['Basic discount / unit', 'dc', 'bd'],
                  ['Net price per unit', 'nt', 'net'],
                  ['Total after basic', 'tt', 'tt'],
                  ['Additional discount', 'ad', 'ad'],
                  ['Item grand total', 'gt', 'gt']
                ];
                const rr = L.map(([l, k, s]) => {
                  const v = g(k);
                  const sum = ['tt', 'ad', 'gt'].includes(k);
                  const summed = sum ? r9(v.reduce((a, x) => a + (+x || 0), 0)) : '';
                  const diff = sum ? r9((summed as number) - it[s]) : '';
                  return cvt({
                    isCur: true,
                    c: k === 'gt' ? 'bg-gray-50 font-medium' : '',
                    v: [l + XN, it[s], summed, diff, ...v]
                  });
                });

                return (
                  <details key={idx} className="group bg-white border border-gray-200 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
                    <summary className="px-5 py-4 cursor-pointer font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span>{it.name || '(No name)'}</span> 
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span> 
                        <span className="text-sm font-normal text-gray-500">{it.type}</span> 
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span> 
                        <span className="text-sm font-normal text-gray-500">Qty: {it.qty}</span>
                      </span>
                      <span className="text-gray-400 transition-transform group-open:rotate-180">
                        <FiPlus />
                      </span>
                    </summary>
                    <div className="p-0 overflow-x-auto border-t border-gray-200">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-400 bg-white border-b border-gray-100">
                          <tr>
                            <th className="px-5 py-3 sticky left-0 bg-white z-10 font-medium">Item Metric</th>
                            <th className="px-5 py-3 text-right font-medium">SO Value</th>
                            <th className="px-5 py-3 text-right font-medium">Inv Total</th>
                            <th className="px-5 py-3 text-right font-medium">Difference</th>
                            {R.cols.map(c => <th key={c.label} className="px-5 py-3 text-right font-medium">{c.label}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rr.map((row: any, i: number) => (
                            <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${row.c || ''}`}>
                              {row.v.map((val: any, j: number) => (
                                <td key={j} className={`px-5 py-2.5 ${j === 0 ? 'sticky left-0 bg-white z-10 font-normal text-gray-600' : 'text-right font-mono text-gray-500'}`}>
                                  {fmt(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
