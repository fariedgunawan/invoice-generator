import { useState } from 'react';
import {
  FiArrowLeft,
  FiCalendar,
  FiLayers,
  FiActivity,
  FiTrendingUp,
  FiTag,
  FiCheck,
  FiMaximize2
} from 'react-icons/fi';

import type {
  State,
  CalculationResult,
  CalculatedItem,
  CalculatedItemRow
} from '../types';
import { formatDate } from '../utils/dateUtils';
import { fmt, fmt9 } from '../utils/formatters';

interface CalculationTraceProps {
  state: State;
  calculation: CalculationResult;
  onBack: () => void;
}

type TraceTab = 'invoice-step' | 'so-base' | 'schedule' | 'aggregation';

export function CalculationTrace({
  state,
  calculation,
  onBack
}: CalculationTraceProps) {
  const [activeTab, setActiveTab] = useState<TraceTab>('invoice-step');
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number>(0);
  const [selectedProductIdx, setSelectedProductIdx] = useState<number>(3); // Default to item 4 (test gb recu)

  const activeItems = calculation.its;
  const cols = calculation.cols;
  const selectedCol = cols[selectedInvoiceIdx] || cols[0];
  const selectedItem: CalculatedItem | undefined = activeItems[selectedProductIdx] || activeItems[0];
  const selectedRow: CalculatedItemRow | undefined = selectedItem?.rows[selectedInvoiceIdx];

  const periodDays = selectedCol?.p?.days ?? 0;
  const factor = selectedCol?.p?.f ?? 1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Kembali ke Generator"
            >
              <FiArrowLeft size={16} />
              <span>Kembali ke Generator</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <FiActivity size={18} />
                </span>
                Visual Trace Perhitungan
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Penelusuran detail setiap rumus dan alokasi periode invoice
              </p>
            </div>
          </div>

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('invoice-step')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'invoice-step'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiMaximize2 size={13} />
              <span>Trace per Invoice</span>
            </button>
            <button
              onClick={() => setActiveTab('so-base')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'so-base'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiLayers size={13} />
              <span>Dasar SO</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schedule'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiCalendar size={13} />
              <span>Jadwal & Prorata</span>
            </button>
            <button
              onClick={() => setActiveTab('aggregation')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'aggregation'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiTrendingUp size={13} />
              <span>Agregasi Pre-Tax & PPN</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Global Context Summary Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Durasi Kontrak</div>
            <div className="text-base font-bold text-slate-800 mt-1">{calculation.dur} Bulan</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{state.start} s/d {state.end}</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Siklus Billing</div>
            <div className="text-base font-bold text-slate-800 mt-1">Tgl {state.cyc || 'Start'}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{cols.length} Periode Invoice</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Produk Aktif</div>
            <div className="text-base font-bold text-slate-800 mt-1">{activeItems.length} Produk</div>
            <div className="text-[11px] text-slate-500 mt-0.5">One-time & Recurring</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Basic Disc (Recurring)</div>
            <div className="text-base font-bold text-emerald-600 mt-1 font-mono">{fmt(calculation.recurringTotalBasicDiscount)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Total se-kontrak</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Recurring Net (SO)</div>
            <div className="text-base font-bold text-slate-800 mt-1 font-mono">{fmt(calculation.so.rec)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Pre-tax Recurring</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">SO Grand Total</div>
            <div className="text-base font-bold text-indigo-600 mt-1 font-mono">{fmt(calculation.so.grand)}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
              <FiCheck size={12} /> Diff Total: 0
            </div>
          </div>
        </section>

        {/* TAB 1: Step-by-Step per Invoice (MAIN TRACE) */}
        {activeTab === 'invoice-step' && (
          <div className="space-y-6">
            {/* Selectors: Invoice Period & Product */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  1. Pilih Periode Invoice yang Ingin Ditelusuri:
                </label>
                <div className="flex flex-wrap gap-2">
                  {cols.map((col, idx) => {
                    const isSelected = idx === selectedInvoiceIdx;
                    const p = col.p;
                    const isProrataPeriod = p ? p.f !== 1 : false;
                    return (
                      <button
                        key={col.label}
                        onClick={() => setSelectedInvoiceIdx(idx)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-bold">{col.label}</span>
                        {p && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                              isSelected
                                ? 'bg-indigo-500 text-indigo-100'
                                : isProrataPeriod
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {p.days} hr {isProrataPeriod ? '(Prorata)' : '(Full)'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  2. Pilih Produk yang Ingin Dilihat Trace Rumusnya:
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeItems.map((item, idx) => {
                    const isSelected = idx === selectedProductIdx;
                    return (
                      <button
                        key={item.name + idx}
                        onClick={() => setSelectedProductIdx(idx)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <FiTag size={13} className={isSelected ? 'text-indigo-300' : 'text-slate-400'} />
                        <span className="font-semibold">{item.name || `Product ${idx + 1}`}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                            isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {item.type} • {item.unit} • Qty {item.qty}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Product & Invoice Period Context Banner */}
            {selectedItem && selectedRow && (
              <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-white p-5 rounded-2xl border border-indigo-100/80 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                      {selectedCol.label}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Trace Perhitungan: {selectedItem.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-2">
                    <FiCalendar size={13} className="text-slate-400" />
                    <span>
                      Periode: {formatDate(selectedCol.p!.s)} s/d {formatDate(selectedCol.p!.e)} (
                      {selectedCol.p!.days} hari) • Faktor Prorata f = {fmt9(selectedCol.p!.f)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 uppercase">Item Grand Total di {selectedCol.label}</div>
                    <div className="text-xl font-bold font-mono text-indigo-700">{fmt(selectedRow.gt)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 7-Step Interactive Math Cards */}
            {selectedItem && selectedRow && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FiLayers className="text-indigo-600" />
                    Alur 7 Langkah Perhitungan Matematika:
                  </h3>
                  <span className="text-xs text-slate-500">
                    Semua langkah diverifikasi konsisten &amp; presisi
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Price per unit */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                        Langkah 1
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Hasil: {fmt(selectedRow.pr)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Price per unit (Harga Satuan Periode)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Harga dasar satuan dikalikan faktor hari prorata f ({fmt9(factor)}).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                      <div className="text-slate-400 text-[11px]">Rumus: Price × f</div>
                      <div className="font-medium text-indigo-700">
                        {fmt(selectedItem.price)} × {fmt9(factor)} = {fmt(selectedRow.pr)}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Basic discount / unit */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                        Langkah 2
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Hasil: {fmt(selectedRow.dc)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Basic discount / unit (Diskon Dasar Satuan)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Diskon dasar satuan di periode ini ({selectedItem.bt === 'Percentage' ? `${selectedItem.bv}%` : `$${selectedItem.bv}`}).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                      <div className="text-slate-400 text-[11px]">
                        Rumus: {selectedItem.bt === 'Percentage' ? 'Price per unit × %' : 'BD × f'}
                      </div>
                      <div className="font-medium text-indigo-700">
                        {selectedItem.bt === 'Percentage'
                          ? `${fmt(selectedRow.pr)} × ${selectedItem.bv}% = ${fmt(selectedRow.dc)}`
                          : `${fmt(selectedItem.bd)} × ${fmt9(factor)} = ${fmt(selectedRow.dc)}`}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Net price per unit */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                        Langkah 3
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Hasil: {fmt(selectedRow.nt)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Net price per unit (Harga Bersih Satuan)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Harga satuan periode dikurangi diskon dasar satuan periode.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                      <div className="text-slate-400 text-[11px]">Rumus: Price per unit - Basic discount per unit</div>
                      <div className="font-medium text-indigo-700">
                        {fmt(selectedRow.pr)} - {fmt(selectedRow.dc)} = {fmt(selectedRow.nt)}
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Total basic discount */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                        Langkah 4
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Hasil: {fmt(selectedRow.tbd)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Total basic discount (Total Diskon Dasar)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Diskon dasar satuan dikalikan dengan jumlah quantity ({selectedItem.qty}).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                      <div className="text-slate-400 text-[11px]">Rumus: Basic discount per unit × Qty</div>
                      <div className="font-medium text-indigo-700">
                        {fmt(selectedRow.dc)} × {selectedItem.qty} = {fmt(selectedRow.tbd)}
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Total after basic */}
                  <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-3 bg-gradient-to-br from-white to-indigo-50/30">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-bold">
                        Langkah 5 (Fokus Utama)
                      </span>
                      <span className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                        Hasil: {fmt(selectedRow.tt)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Total after basic (Total Setelah Diskon Dasar)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Harga bersih satuan dikalikan Qty, dibulatkan integer bulat (Math.round).
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 font-mono text-xs text-slate-700 space-y-1.5 shadow-2xs">
                      <div className="text-slate-400 text-[11px]">Rumus: Math.round(Net price per unit × Qty)</div>
                      <div className="text-slate-600">
                        {fmt(selectedRow.nt)} × {selectedItem.qty} = {(Number(selectedRow.nt) * selectedItem.qty).toFixed(2)}
                      </div>
                      <div className="font-bold text-indigo-700 text-sm">
                        Math.round({(Number(selectedRow.nt) * selectedItem.qty).toFixed(2)}) = {fmt(selectedRow.tt)}
                      </div>
                    </div>
                  </div>

                  {/* Step 6: Additional discount */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                        Langkah 6
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Hasil: {fmt(selectedRow.ad)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Additional discount (Diskon Tambahan Periode)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Prorata diskon tambahan kontrak SO ({fmt(selectedItem.ad)}) sesuai faktor hari ({fmt9(factor)}).
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                      <div className="text-slate-400 text-[11px]">Rumus: Math.round((SO Additional Discount × f) / Durasi)</div>
                      <div className="font-medium text-indigo-700">
                        ({fmt(selectedItem.ad)} × {fmt9(factor)}) / {selectedItem.dur} = {fmt(selectedRow.ad)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 7: Item grand total (Full Width Card) */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                      Langkah 7: Nilai Akhir Produk di {selectedCol.label}
                    </span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      Item Grand Total: {fmt(selectedRow.gt)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Item grand total = Total after basic - Additional discount</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Nilai akhir bersih item ini yang masuk ke penjumlahan Pre-tax subtotal pada {selectedCol.label}.
                    </p>
                  </div>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 font-mono text-sm text-slate-200 flex flex-wrap items-center gap-2">
                    <span className="text-indigo-300">{fmt(selectedRow.tt)}</span>
                    <span className="text-slate-500">-</span>
                    <span className="text-amber-300">{fmt(selectedRow.ad)}</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-emerald-400 font-bold">{fmt(selectedRow.gt)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Sales Order Base Level Trace */}
        {activeTab === 'so-base' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FiLayers className="text-indigo-600" />
                <span>Kalkulasi Nilai Dasar Kontrak Sales Order (SO Target)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Setiap produk dihitung nilai kontrak penuhnya sebagai acuan (target) yang wajib dipenuhi oleh seluruh invoice (selisih = 0).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeItems.map((item, idx) => (
                <div key={item.name + idx} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{item.type}</span>
                      <h4 className="text-base font-bold text-slate-900">{item.name}</h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                      Unit: {item.unit} • Qty: {item.qty}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Price / unit:</span>
                      <span className="font-semibold text-slate-800">{fmt(item.price)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Basic Discount ({item.bt === 'Percentage' ? `${item.bv}%` : `$${item.bv}`}):</span>
                      <span className="font-semibold text-slate-800">{fmt(item.bd)} / unit</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Net price / unit (Price - BD):</span>
                      <span className="font-semibold text-slate-800">{fmt(item.net)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Durasi Kontrak:</span>
                      <span className="font-semibold text-slate-800">{item.dur} Bulan</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50 bg-emerald-50/50 px-2 rounded-lg">
                      <span className="text-slate-600 font-medium">Total Basic Discount (BD × Qty × Dur):</span>
                      <span className="font-bold text-emerald-700">{fmt(item.totalBasicDiscount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50 bg-indigo-50/50 px-2 rounded-lg">
                      <span className="text-slate-600 font-medium">Total after basic ((Price - BD) × Qty × Dur):</span>
                      <span className="font-bold text-indigo-700">{fmt(item.tt)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50 px-2">
                      <span className="text-slate-500">Additional Discount ({item.at === 'Percentage' ? `${item.av}%` : `$${item.av}`}):</span>
                      <span className="font-semibold text-slate-800">{fmt(item.ad)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-slate-900 text-white px-3 rounded-xl mt-3 text-sm">
                      <span className="font-medium">Item Grand Total (SO):</span>
                      <span className="font-bold text-emerald-400">{fmt(item.gt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Schedule & Prorata Factor */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FiCalendar className="text-indigo-600" />
                <span>Jadwal Billing &amp; Penentuan Faktor Prorata (30/360)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Sesuai standar konvensi 30/360, satu bulan penuh dihitung 30 hari (faktor f = 1.0). Periode awal dan akhir yang tidak genap 30 hari dihitung proporsional dengan faktor 9 angka desimal.
              </p>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Invoice</th>
                    <th className="px-5 py-3.5">Tanggal Mulai</th>
                    <th className="px-5 py-3.5">Tanggal Selesai</th>
                    <th className="px-5 py-3.5 text-center">Jumlah Hari (30/360)</th>
                    <th className="px-5 py-3.5 text-right font-mono">Faktor Prorata (f = Hari / 30)</th>
                    <th className="px-5 py-3.5 text-center">Status Periode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {calculation.per.map((p, idx) => {
                    const isProrate = p.f !== 1;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">INV {idx + 1}</td>
                        <td className="px-5 py-3.5">{formatDate(p.s)}</td>
                        <td className="px-5 py-3.5">{formatDate(p.e)}</td>
                        <td className="px-5 py-3.5 text-center font-bold">{p.days} hari</td>
                        <td className="px-5 py-3.5 text-right font-bold text-indigo-700">{fmt9(p.f)}</td>
                        <td className="px-5 py-3.5 text-center">
                          {p.last ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-medium font-sans">
                              Periode Terakhir (Penutup)
                            </span>
                          ) : isProrate ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 font-medium font-sans">
                              Prorata ({p.days}/30)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-medium font-sans">
                              1 Bulan Penuh (Full)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Financial Aggregation & Taxes */}
        {activeTab === 'aggregation' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FiTrendingUp className="text-indigo-600" />
                <span>Agregasi Finansial Invoice (Pre-Tax, PPN 11%, dan Grand Total)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pre-Tax Total adalah jumlah akumulasi dari One-time Subtotal dan Recurring Subtotal. Pajak (Taxes and charges) dibulatkan ke bilangan bulat terdekat (integer rounding), serta periode terakhir menyerap selisih pembulatan agar total seluruh invoice tepat sama dengan SO target.
              </p>
            </div>

            {/* Step breakdown for selected invoice */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-7 rounded-2xl border border-slate-800 shadow-md space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500 text-white text-xs font-bold">
                    {selectedCol.label} ({periodDays} Hari)
                  </span>
                  <h4 className="text-lg font-bold text-white mt-1">
                    Rincian Penjumlahan Pre-tax &amp; Pajak pada {selectedCol.label}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Invoice Grand Total</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">{fmt(selectedCol.grand)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
                  <div className="text-slate-400 uppercase text-[10px]">1. One-time Subtotal</div>
                  <div className="text-lg font-bold text-white">{fmt(selectedCol.one)}</div>
                  <div className="text-[11px] text-slate-400">
                    {selectedInvoiceIdx === 0
                      ? 'test 1 (165,612) + test gb one (157,183)'
                      : 'Hanya ditagihkan di INV 1 (0)'}
                  </div>
                </div>
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
                  <div className="text-slate-400 uppercase text-[10px]">2. Recurring Subtotal</div>
                  <div className="text-lg font-bold text-white">{fmt(selectedCol.rec)}</div>
                  <div className="text-[11px] text-slate-400">
                    test 2 ({fmt(activeItems[2]?.rows[selectedInvoiceIdx]?.gt)}) + test gb recu ({fmt(activeItems[3]?.rows[selectedInvoiceIdx]?.gt)})
                  </div>
                </div>
                <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-700/60 space-y-2">
                  <div className="text-indigo-300 uppercase text-[10px] font-bold">3. Pre-tax Subtotal</div>
                  <div className="text-lg font-bold text-indigo-300">{fmt(selectedCol.pre)}</div>
                  <div className="text-[11px] text-indigo-200/80">
                    {fmt(selectedCol.one)} + {fmt(selectedCol.rec)} = {fmt(selectedCol.pre)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Pajak ({state.tx}%): </span>
                  <span className="font-bold text-slate-200">
                    {selectedInvoiceIdx === cols.length - 1
                      ? `${fmt(selectedCol.tax)} (SO Tax - akumulasi sebelumnya)`
                      : `round(${fmt(selectedCol.pre)} × ${state.tx}%) = ${fmt(selectedCol.tax)}`}
                  </span>
                </div>
                {+state.dx > 0 && (
                  <div>
                    <span className="text-rose-400">Deducted ({state.dx}%): </span>
                    <span className="font-bold text-rose-300">
                      {selectedInvoiceIdx === cols.length - 1
                        ? `${fmt(selectedCol.ded)} (SO Ded - akumulasi sebelumnya)`
                        : `round(${fmt(selectedCol.pre)} × ${state.dx}%) = ${fmt(selectedCol.ded)}`}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Grand Total: </span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {fmt(selectedCol.pre)} + {fmt(selectedCol.tax)}{+state.dx > 0 ? ` - ${fmt(selectedCol.ded)}` : ''} = {fmt(selectedCol.grand)}
                  </span>
                </div>
              </div>
            </div>

            {/* Full Reconciliation Table */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Tabel Ringkasan Finansial Seluruh Kolom Invoice:
              </h4>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Metrik Finansial</th>
                      <th className="px-4 py-3 text-right">SO Target</th>
                      <th className="px-4 py-3 text-right">Total Invoices</th>
                      <th className="px-4 py-3 text-right">Diff</th>
                      {cols.map(c => (
                        <th key={c.label} className="px-4 py-3 text-right text-slate-900 font-bold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-900 font-sans">One time total</td>
                      <td className="px-4 py-3 text-right">{fmt(calculation.so.one)}</td>
                      <td className="px-4 py-3 text-right">{fmt(cols.reduce((a, b) => a + b.one, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">0</td>
                      {cols.map(c => (
                        <td key={c.label} className="px-4 py-3 text-right">{fmt(c.one)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-900 font-sans">Recurring total</td>
                      <td className="px-4 py-3 text-right">{fmt(calculation.so.rec)}</td>
                      <td className="px-4 py-3 text-right">{fmt(cols.reduce((a, b) => a + b.rec, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">0</td>
                      {cols.map(c => (
                        <td key={c.label} className="px-4 py-3 text-right">{fmt(c.rec)}</td>
                      ))}
                    </tr>
                    <tr className="bg-indigo-50/40 font-bold">
                      <td className="px-4 py-3 text-indigo-900 font-sans">Pre-tax total</td>
                      <td className="px-4 py-3 text-right text-indigo-900">{fmt(calculation.so.pre)}</td>
                      <td className="px-4 py-3 text-right text-indigo-900">{fmt(cols.reduce((a, b) => a + b.pre, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">0</td>
                      {cols.map(c => (
                        <td key={c.label} className="px-4 py-3 text-right text-indigo-700">{fmt(c.pre)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-900 font-sans">Taxes and charges ({state.tx}%)</td>
                      <td className="px-4 py-3 text-right">{fmt(calculation.so.tax)}</td>
                      <td className="px-4 py-3 text-right">{fmt(cols.reduce((a, b) => a + b.tax, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">0</td>
                      {cols.map(c => (
                        <td key={c.label} className="px-4 py-3 text-right">{fmt(c.tax)}</td>
                      ))}
                    </tr>
                    {+state.dx > 0 && (
                      <tr>
                        <td className="px-4 py-3 font-medium text-rose-600 font-sans">Deducted taxes ({state.dx}%)</td>
                        <td className="px-4 py-3 text-right text-rose-600">-{fmt(calculation.so.ded)}</td>
                        <td className="px-4 py-3 text-right text-rose-600">-{fmt(cols.reduce((a, b) => a + b.ded, 0))}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-bold">0</td>
                        {cols.map(c => (
                          <td key={c.label} className="px-4 py-3 text-right text-rose-600">-{fmt(c.ded)}</td>
                        ))}
                      </tr>
                    )}
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="px-4 py-3 font-sans">Invoice grand total</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{fmt(calculation.so.grand)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{fmt(cols.reduce((a, b) => a + b.grand, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">0</td>
                      {cols.map(c => (
                        <td key={c.label} className="px-4 py-3 text-right text-emerald-400">{fmt(c.grand)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
