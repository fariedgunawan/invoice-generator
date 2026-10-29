import { Fragment, useState, useMemo } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiInfo,
  FiAlertCircle,
  FiCheckCircle,
  FiActivity,
  FiChevronDown,
  FiChevronRight
} from 'react-icons/fi';

import type {
  Item,
  State,
  ProductType,
  AmountType,
  BillingFrequency,
  InvoicePeriod,
  CalculatedItem,
  UnitType
} from './types';
import { calculate } from './utils/calculator';
import { formatDate } from './utils/dateUtils';
import { fmt, fmt2, fmt9, r9 } from './utils/formatters';
import { DateInput } from './components/DateInput';
import { FormInput } from './components/FormInput';
import { CalculationTrace } from './components/CalculationTrace';

interface TableDisplayRow {
  id?: string;
  c?: string;
  isCur?: boolean;
  v: (string | number)[];
  raw?: (string | number)[];
}

// Opsi pilihan tipe
const PRODUCT_TYPES: ProductType[] = ['One time', 'Recurring', 'DR (Daily)'];
const UNIT_TYPES: UnitType[] = ['Unit', 'GB'];
const AMOUNT_TYPES: AmountType[] = ['Amount', 'Percentage'];
const BILLING_FREQUENCIES: BillingFrequency[] = ['Monthly', 'Quarterly', 'Semester', 'Yearly'];

// Data dummy awal sesuai test case
const initialItems: Item[] = [
  { id: '1', name: 'test 1', type: 'One time', unit: 'Unit', price: '123125', bt: 'Percentage', bv: '23.13', qty: '2', ds: '', de: '', at: 'Percentage', av: '12.51', so: '' },
  { id: '2', name: 'test gb one', type: 'One time', unit: 'GB', price: '1259.49', bt: 'Percentage', bv: '11.57', qty: '157', ds: '', de: '', at: 'Percentage', av: '10.11', so: '' },
  { id: '3', name: 'test 2', type: 'Recurring', unit: 'Unit', price: '100557', bt: 'Amount', bv: '1107', qty: '2', ds: '', de: '', at: 'Percentage', av: '15.13', so: '' },
  { id: '4', name: 'test gb recu', type: 'Recurring', unit: 'GB', price: '1827.77', bt: 'Amount', bv: '123.57', qty: '1087', ds: '', de: '', at: 'Percentage', av: '12.12', so: '' }
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<'generator' | 'trace'>('generator');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  const [state, setState] = useState<State>({
    start: '2026-01-01',
    end: '2026-12-31',
    freq: 'Quarterly',
    cyc: '20',
    tx: '11',
    dx: '0',
    xn: '',
    xr: '1',
    items: initialItems,
  });

  // Eksekusi kalkulasi utama secara reaktif
  const calculation = useMemo(() => calculate(state), [state]);

  // Validasi & pengecekan selisih tambahan pasca-kalkulasi
  const warnings = [...calculation.W];

  const targetCurrencySuffix = state.xn ? ` (${state.xn})` : '';
  const exchangeRateMultiplier = +state.xr || 1;

  // Helper konversi kurs mata uang asing
  const applyExchangeRate = (row: TableDisplayRow): TableDisplayRow => {
    if (row.isCur) {
      row.v = row.v.map((val, idx) =>
        idx > 0 && typeof val === 'number' ? r9(val * exchangeRateMultiplier) : val
      );
    }
    return row;
  };

  // Helper membuat baris keuangan pada tabel ringkasan.
  // Jika rawKey diberikan, ditambahkan sub-baris 'Before rounding' (nilai sebelum pembulatan) yang bisa di-expand.
  const createFinancialRow = (
    label: string,
    key: string,
    customClass: string = '',
    rawKey?: string
  ): TableDisplayRow => {
    const numberOf = (obj: Record<string, unknown>, k: string): number =>
      typeof obj[k] === 'number' ? (obj[k] as number) : 0;

    const totalInvoices = r9(calculation.cols.reduce((sum, col) => sum + numberOf(col, key), 0));
    const soValue = numberOf(calculation.so, key);
    const diff = r9(totalInvoices - soValue);

    const row = applyExchangeRate({
      id: key,
      c: customClass,
      isCur: true,
      v: [
        label + targetCurrencySuffix,
        soValue,
        totalInvoices,
        diff,
        ...calculation.cols.map(col => (typeof col[key] === 'number' ? (col[key] as number) : ''))
      ]
    });

    if (rawKey) {
      const rawTotal = r9(calculation.cols.reduce((sum, col) => sum + numberOf(col, rawKey), 0));
      const rawSo = numberOf(calculation.so, rawKey);
      const rawRow = applyExchangeRate({
        isCur: true,
        v: [
          'Before rounding (2 decimals)',
          rawSo,
          rawTotal,
          r9(rawTotal - rawSo),
          ...calculation.cols.map(col => numberOf(col, rawKey))
        ]
      });
      row.raw = rawRow.v;
    }

    return row;
  };

  // Helper membuat baris informasi jadwal (periode & hari)
  const createPeriodInfoRow = (
    label: string,
    valueExtractor: (p: InvoicePeriod) => string | number
  ): TableDisplayRow => ({
    v: [
      label,
      '',
      '',
      '',
      ...calculation.cols.map(col => (col.p ? valueExtractor(col.p) : ''))
    ]
  });

  const invoiceSummaryRows: TableDisplayRow[] = [
    createPeriodInfoRow('Period start', p => formatDate(p.s)),
    createPeriodInfoRow('Period end', p => formatDate(p.e)),
    createPeriodInfoRow('Days (30/360)', p => p.days),
    createPeriodInfoRow('Pro-rata factor (days / 30)', p => p.f),
    createFinancialRow('One time total', 'one'),
    createFinancialRow('Recurring total', 'rec'),
    createFinancialRow('Total basic discount', 'totalBasicDisc', 'text-gray-500 text-xs italic'),
    createFinancialRow('Total additional discount', 'totalAddlDisc', 'text-gray-500 text-xs italic'),
    createFinancialRow('DR (Daily) total', 'dr'),
    createFinancialRow('Pre-tax total', 'pre', 'font-medium bg-gray-50 border-t border-b border-gray-100', 'preRaw'),
    createFinancialRow('Taxes and charges', 'tax', '', 'taxRaw'),
    createFinancialRow('Deducted taxes', 'ded', '', 'dedRaw'),
    createFinancialRow('Invoice grand total', 'grand', 'font-semibold bg-gray-100', 'grandRaw')
  ];

  // Pengecekan selisih pre-tax & nilai negatif
  const preTaxRow = invoiceSummaryRows.find(row => String(row.v[0]).startsWith('Pre-tax total'));
  const preTaxDifference = preTaxRow ? r9(preTaxRow.v[3] as number) : 0;
  if (calculation.cols.length && Math.abs(preTaxDifference) >= 0.01) {
    warnings.push('Pre-tax of invoices differs from SO by ' + fmt(preTaxDifference));
  }
  if (calculation.cols.some(col => col.grand < 0)) {
    warnings.push('An invoice has a negative amount: check dates and durations');
  }

  // Action Handlers
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
      items: [
        ...state.items,
        {
          id: Math.random().toString(36).slice(2, 9),
          name: '',
          type: 'Recurring',
          unit: 'Unit',
          price: '',
          bt: 'Amount',
          bv: '',
          qty: '1',
          ds: '',
          de: '',
          at: 'Amount',
          av: '',
          so: ''
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    setState({
      ...state,
      items: state.items.filter((_, i) => i !== index)
    });
  };

  const inputClass =
    'bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none transition text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full placeholder-gray-300 hover:border-gray-300';
  const selectClass =
    'bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none transition text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full hover:border-gray-300 cursor-pointer';

  if (currentPage === 'trace') {
    return (
      <CalculationTrace
        state={state}
        calculation={calculation}
        onBack={() => setCurrentPage('generator')}
      />
    );
  }

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
          <div className="flex items-center gap-2 self-center md:self-auto">
            <button
              onClick={() => setCurrentPage('trace')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-xs transition-all cursor-pointer"
            >
              <FiActivity size={16} className="text-indigo-600" />
              <span>Visual Trace Perhitungan</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-200 text-indigo-900 text-[10px] font-bold">Baru</span>
            </button>
          </div>
        </header>

        {/* 1. Global Parameters */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-medium mb-6 text-gray-800 flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">
              1
            </span>
            Global Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            <FormInput label="Start Subscription">
              <DateInput
                className={inputClass}
                value={state.start}
                onChange={e => updateParam('start', e.target.value)}
              />
            </FormInput>
            <FormInput label="End Subscription">
              <DateInput
                className={inputClass}
                value={state.end}
                onChange={e => updateParam('end', e.target.value)}
              />
            </FormInput>
            <FormInput label="Billing Period">
              <select
                className={selectClass}
                value={state.freq}
                onChange={e => updateParam('freq', e.target.value as BillingFrequency)}
              >
                {BILLING_FREQUENCIES.map(freq => (
                  <option key={freq} value={freq}>
                    {freq}
                  </option>
                ))}
              </select>
            </FormInput>
            <FormInput label="Invoice Cycle Day" note="Blank = follows start date">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.cyc}
                onChange={e => updateParam('cyc', e.target.value)}
                placeholder="e.g. 20"
              />
            </FormInput>
            <FormInput label="Taxes & Charges (%)">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.tx}
                onChange={e => updateParam('tx', e.target.value)}
              />
            </FormInput>
            <FormInput label="Deducted Taxes (%)">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.dx}
                onChange={e => updateParam('dx', e.target.value)}
              />
            </FormInput>
            <FormInput label="Target Currency">
              <input
                type="text"
                className={inputClass}
                value={state.xn}
                onChange={e => updateParam('xn', e.target.value)}
                placeholder="e.g. IDR"
              />
            </FormInput>
            <FormInput label="Exchange Rate">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.xr}
                onChange={e => updateParam('xr', e.target.value)}
              />
            </FormInput>
          </div>

          <div className="mt-8 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 inline-flex items-center text-sm text-gray-600 font-medium">
            {`Recurring duration: ${fmt(calculation.dur)} months • ${calculation.mpi} month(s) per invoice • ${calculation.per.length} invoice(s)`}
          </div>
        </section>

        {/* 2. Products List */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-medium mb-6 text-gray-800 flex items-center gap-3">
            <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">
              2
            </span>
            Products List
          </h2>

          {/* Discounts & Totals Overview */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Basic Discount</span>
              <div className="text-xl font-semibold font-mono text-gray-900 mt-1">
                {fmt(calculation.totalBasicDiscount)} {state.xn}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Additional Discount</span>
              <div className="text-xl font-semibold font-mono text-gray-900 mt-1">
                {fmt(calculation.so.totalAddlDisc)} {state.xn}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Recurring Net (SO)</span>
              <div className="text-xl font-semibold font-mono text-gray-900 mt-1">
                {fmt(calculation.so.rec)} {state.xn}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl mb-6 shadow-sm">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5 font-medium">Product Name</th>
                  <th className="px-4 py-3.5 font-medium min-w-[130px]">Type</th>
                  <th className="px-4 py-3.5 font-medium min-w-[90px]">Unit</th>
                  <th className="px-4 py-3.5 font-medium">Price / unit</th>
                  <th className="px-4 py-3.5 font-medium min-w-[170px]">Basic Discount</th>
                  <th className="px-4 py-3.5 font-medium w-24">Qty</th>
                  <th className="px-4 py-3.5 font-medium min-w-[140px]">DR Date Range</th>
                  <th className="px-4 py-3.5 font-medium min-w-[170px]">Addt'l Discount</th>
                  <th className="px-4 py-3.5 font-medium text-right min-w-[120px]">Calc. Total</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.items.map((item, i) => {
                  const calculated = calculation.all[i];

                  return (
                    <tr key={item.id} className="bg-white hover:bg-gray-50/50 transition-colors group">
                      <td className="px-3 py-3">
                        <input
                          className={inputClass}
                          value={item.name}
                          onChange={e => updateItem(i, 'name', e.target.value)}
                          placeholder="Name"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={item.type}
                          onChange={e => updateItem(i, 'type', e.target.value as ProductType)}
                        >
                          {PRODUCT_TYPES.map(t => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={item.unit || 'Unit'}
                          onChange={e => updateItem(i, 'unit', e.target.value as UnitType)}
                        >
                          {UNIT_TYPES.map(u => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          value={item.price}
                          onChange={e => updateItem(i, 'price', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select
                            className={selectClass + ' !px-2 w-[70px]'}
                            value={item.bt}
                            onChange={e => updateItem(i, 'bt', e.target.value as AmountType)}
                          >
                            {AMOUNT_TYPES.map(a => (
                              <option key={a} value={a}>
                                {a === 'Amount' ? '$' : '%'}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass + ' w-[90px]'}
                            value={item.bv}
                            onChange={e => updateItem(i, 'bv', e.target.value)}
                            placeholder={item.bt === 'Percentage' ? '%' : 'Amt'}
                          />
                        </div>
                        {calculated?.used && (
                          <div className="text-[11px] text-gray-400 mt-1 font-mono">
                            Total: {fmt(calculated.totalBasicDiscount)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          value={item.qty}
                          onChange={e => updateItem(i, 'qty', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <DateInput
                            className={inputClass + ' !py-1 text-[13px]'}
                            value={item.ds}
                            onChange={e => updateItem(i, 'ds', e.target.value)}
                            style={{ width: '130px' }}
                          />
                          <DateInput
                            className={inputClass + ' !py-1 text-[13px]'}
                            value={item.de}
                            onChange={e => updateItem(i, 'de', e.target.value)}
                            style={{ width: '130px' }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select
                            className={selectClass + ' !px-2 w-[70px]'}
                            value={item.at}
                            onChange={e => updateItem(i, 'at', e.target.value as AmountType)}
                          >
                            {AMOUNT_TYPES.map(a => (
                              <option key={a} value={a}>
                                {a === 'Amount' ? '$' : '%'}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass + ' w-[90px]'}
                            value={item.av}
                            onChange={e => updateItem(i, 'av', e.target.value)}
                            placeholder={item.at === 'Percentage' ? '%' : 'Amt'}
                          />
                        </div>
                        {calculated?.used && (
                          <div className="text-[11px] text-gray-400 mt-1 font-mono">
                            Total: {fmt(calculated.ad)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                        {calculated?.used ? fmt(calculated.gt) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => removeItem(i)}
                          className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                          title="Remove Item"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-sm transition font-medium text-sm w-full sm:w-auto"
          >
            <FiPlus size={16} /> Add Product
          </button>

          <p className="mt-6 text-xs text-gray-400 flex gap-2 font-normal">
            <FiInfo className="shrink-0 mt-0.5" />
            <span>Recurring duration is automatic from start/end. One time = billed in INV 1. DR = price × qty × days. Unit GB = unrounded (2 decimal places), Unit non-GB = rounded to integer. Rows without a price are ignored.</span>
          </p>
        </section>

        {/* 3. Invoices Breakdown */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-medium text-gray-800 flex items-center gap-3">
              <span className="bg-gray-100 text-gray-600 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200">
                3
              </span>
              Invoices Breakdown
            </h2>
            <button
              onClick={() => setCurrentPage('trace')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
            >
              <FiActivity size={14} className="text-indigo-600" />
              <span>Lihat Visual Trace Rumus</span>
            </button>
          </div>

          {warnings.length > 0 ? (
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3 text-gray-800">
                <FiAlertCircle className="mt-0.5 shrink-0" size={18} />
                <div className="flex flex-col gap-1.5">
                  {warnings.map((w, idx) => (
                    <span key={idx} className="text-sm">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-600 flex items-center gap-2 text-sm font-medium">
              <FiCheckCircle size={18} /> All invoices match the Sales Order amounts perfectly.
            </div>
          )}

          {calculation.cols.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl mb-8 shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 sticky left-0 bg-gray-50 z-10 w-48 font-medium">
                      Description
                    </th>
                    <th className="px-5 py-4 text-right font-medium">SO Value</th>
                    <th className="px-5 py-4 text-right font-medium">Invoice Total</th>
                    <th className="px-5 py-4 text-right font-medium">Difference</th>
                    {calculation.cols.map(c => (
                      <th key={c.label} className="px-5 py-4 text-right font-medium text-gray-900">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoiceSummaryRows.map((row, i) => {
                    const isFactorRow = String(row.v[0]).includes('Pro-rata factor');
                    const rowId = row.id;
                    const isExpandable = Boolean(rowId && row.raw);
                    const isExpanded = Boolean(rowId && expandedRows[rowId]);
                    return (
                      <Fragment key={i}>
                        <tr className={`hover:bg-gray-50/50 transition-colors ${row.c || ''}`}>
                          {row.v.map((val, j) => (
                            <td
                              key={j}
                              className={`px-5 py-3.5 ${j === 0
                                  ? 'sticky left-0 bg-white z-10 font-medium text-gray-700'
                                  : 'text-right font-mono text-gray-600'
                                }`}
                            >
                              {j === 0 && isExpandable && rowId ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(rowId)}
                                  aria-expanded={isExpanded}
                                  title="Tampilkan nilai sebelum pembulatan"
                                  className="inline-flex items-center gap-1.5 cursor-pointer text-left hover:text-gray-900"
                                >
                                  {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                                  <span>{fmt(val)}</span>
                                </button>
                              ) : isFactorRow && typeof val === 'number' ? (
                                fmt9(val)
                              ) : (
                                fmt(val)
                              )}
                            </td>
                          ))}
                        </tr>
                        {isExpanded && row.raw && (
                          <tr className="bg-gray-50 text-xs italic text-gray-500">
                            {row.raw.map((val, j) => (
                              <td
                                key={j}
                                className={`px-5 py-2.5 ${j === 0
                                    ? 'sticky left-0 bg-gray-50 z-10 pl-12 font-medium not-italic'
                                    : 'text-right font-mono'
                                  }`}
                              >
                                {j === 0 ? val : fmt2(val)}
                              </td>
                            ))}
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300 font-medium text-sm">
              Enter valid dates and at least one product with a price to see the invoice breakdown.
            </div>
          )}

          {/* Details per Product */}
          {calculation.cols.length > 0 && calculation.its.length > 0 && (
            <div className="mt-10 space-y-4">
              <h3 className="text-base font-medium text-gray-800 mb-5">Product Level Breakdown</h3>

              {calculation.its.map((item: CalculatedItem, idx: number) => {
                const getPeriodMetric = (k: keyof typeof item.rows[0]) =>
                  calculation.cols.map(c => item.rows[calculation.cols.indexOf(c)][k]);

                const metricRows: [string, keyof typeof item.rows[0], keyof CalculatedItem][] = [
                  ['Price per unit', 'pr', 'price'],
                  ['Basic discount / unit', 'dc', 'bd'],
                  ['Total basic discount', 'tbd', 'totalBasicDiscount'],
                  ['Net price per unit', 'nt', 'net'],
                  ['Total after basic', 'tt', 'tt'],
                  ['Additional discount', 'ad', 'ad'],
                  ['Item grand total', 'gt', 'gt']
                ];

                const productTableRows: TableDisplayRow[] = metricRows.map(([label, metricKey, soKey]) => {
                  const periodValues = getPeriodMetric(metricKey);
                  const isSummable = ['tbd', 'tt', 'ad', 'gt'].includes(metricKey);
                  const summed = isSummable
                    ? r9(periodValues.reduce<number>((acc, val) => acc + (+val || 0), 0))
                    : '';
                  const diff = isSummable ? r9((summed as number) - (item[soKey] as number)) : '';

                  return applyExchangeRate({
                    isCur: true,
                    c: metricKey === 'gt' ? 'bg-gray-50 font-medium' : '',
                    v: [
                      label + targetCurrencySuffix,
                      item[soKey] as number,
                      summed,
                      diff,
                      ...periodValues
                    ]
                  });
                });

                return (
                  <details
                    key={idx}
                    className="group bg-white border border-gray-200 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm"
                  >
                    <summary className="px-5 py-4 cursor-pointer font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span>{item.name || '(No name)'}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-sm font-normal text-gray-500">{item.type}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-sm font-normal text-gray-500">Unit: {item.unit}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-sm font-normal text-gray-500">Qty: {item.qty}</span>
                      </span>
                      <span className="text-gray-400 transition-transform group-open:rotate-180">
                        <FiPlus />
                      </span>
                    </summary>
                    <div className="p-0 overflow-x-auto border-t border-gray-200">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-gray-400 bg-white border-b border-gray-100">
                          <tr>
                            <th className="px-5 py-3 sticky left-0 bg-white z-10 font-medium">
                              Item Metric
                            </th>
                            <th className="px-5 py-3 text-right font-medium">SO Value</th>
                            <th className="px-5 py-3 text-right font-medium">Inv Total</th>
                            <th className="px-5 py-3 text-right font-medium">Difference</th>
                            {calculation.cols.map(c => (
                              <th key={c.label} className="px-5 py-3 text-right font-medium">
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {productTableRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={`hover:bg-gray-50/50 transition-colors ${row.c || ''}`}
                            >
                              {row.v.map((val, j) => (
                                <td
                                  key={j}
                                  className={`px-5 py-2.5 ${j === 0
                                      ? 'sticky left-0 bg-white z-10 font-normal text-gray-600'
                                      : 'text-right font-mono text-gray-500'
                                    }`}
                                >
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
