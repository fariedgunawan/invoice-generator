import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';

import type {
  State,
  CalculationResult,
  CalculatedItem,
  CalculatedItemRow,
  InvoiceFinancialSummary,
  ProductType
} from '../types';
import { formatDate } from '../utils/dateUtils';
import { fmt, fmt9, r9 } from '../utils/formatters';

interface CalculationTraceProps {
  state: State;
  calculation: CalculationResult;
  onBack: () => void;
}

type TraceTab = 'invoice-step' | 'so-base' | 'schedule' | 'aggregation';

const TABS: { id: TraceTab; label: string }[] = [
  { id: 'invoice-step', label: 'Trace per Invoice' },
  { id: 'so-base', label: 'Dasar SO' },
  { id: 'schedule', label: 'Jadwal & Prorata' },
  { id: 'aggregation', label: 'Agregasi Pajak & Total' }
];

/** Satu langkah perhitungan: nomor, judul, penjelasan, rumus, dan hasil. */
function StepCard({
  no,
  title,
  desc,
  rule,
  calc,
  result,
  main = false
}: {
  no: number;
  title: string;
  desc: string;
  rule: string;
  calc: string[];
  result: string;
  main?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg border p-5 space-y-3 ${
        main ? 'border-slate-900' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {no}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Hasil</div>
          <div className="font-mono text-sm font-semibold text-slate-900">{result}</div>
        </div>
      </div>
      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 font-mono text-xs space-y-1">
        <div className="text-slate-500">Rumus: {rule}</div>
        {calc.map((line, i) => (
          <div key={i} className="text-slate-900">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalculationTrace({ state, calculation, onBack }: CalculationTraceProps) {
  const [activeTab, setActiveTab] = useState<TraceTab>('invoice-step');
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number>(0);
  const [selectedProductIdx, setSelectedProductIdx] = useState<number>(3);

  const activeItems = calculation.its;
  const cols = calculation.cols;
  const selectedCol: InvoiceFinancialSummary | undefined = cols[selectedInvoiceIdx] || cols[0];
  const selectedItem: CalculatedItem | undefined = activeItems[selectedProductIdx] || activeItems[0];
  const selectedRow: CalculatedItemRow | undefined = selectedItem?.rows[selectedInvoiceIdx];

  const factor = selectedCol?.p?.f ?? 1;
  const hasDeduction = +state.dx > 0;

  const sumCols = (key: 'one' | 'rec' | 'dr' | 'pre' | 'tax' | 'ded' | 'grand'): number =>
    r9(cols.reduce((acc, c) => acc + (c[key] as number), 0));
  const diffOf = (key: 'one' | 'rec' | 'dr' | 'pre' | 'tax' | 'ded' | 'grand'): number =>
    r9(sumCols(key) - (calculation.so[key] as number));

  const grandDiff = diffOf('grand');

  /** Daftar produk per tipe beserta nilainya di invoice terpilih. */
  const itemsOfType = (type: ProductType): string => {
    const list = activeItems.filter(i => i.type === type);
    if (!list.length) return 'Tidak ada produk';
    return list.map(i => `${i.name} (${fmt(i.rows[selectedInvoiceIdx]?.gt)})`).join(' + ');
  };

  /** Pemilih periode invoice (dipakai di tab Trace per Invoice dan Agregasi). */
  const invoiceSelector = (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs font-medium text-slate-500 mb-2">Pilih invoice</div>
      <div className="flex flex-wrap gap-2">
        {cols.map((col, idx) => {
          const selected = idx === selectedInvoiceIdx;
          return (
            <button
              key={col.label}
              onClick={() => setSelectedInvoiceIdx(idx)}
              className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                selected
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span className="font-semibold">{col.label}</span>
              {col.p && (
                <span className={selected ? 'text-slate-300' : 'text-slate-500'}>
                  {' '}
                  · {col.p.days} hari{col.p.f !== 1 ? ' (prorata)' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const th = 'px-4 py-3 font-medium';
  const td = 'px-4 py-3';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Kembali ke Generator"
            >
              <FiArrowLeft size={15} />
              <span>Kembali ke Generator</span>
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Trace Perhitungan</h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Penelusuran rumus dan alokasi periode invoice, langkah demi langkah
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Ringkasan kontrak */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Durasi kontrak', value: `${calculation.dur} bulan`, note: `${state.start} s/d ${state.end}` },
            { label: 'Jumlah invoice', value: `${cols.length}`, note: `Siklus tanggal ${state.cyc || '-'}` },
            { label: 'Produk aktif', value: `${activeItems.length}`, note: 'Item dengan harga terisi' },
            { label: 'Pre-tax SO', value: fmt(calculation.so.pre), note: 'Sebelum pajak' },
            {
              label: 'Grand total SO',
              value: fmt(calculation.so.grand),
              note: grandDiff === 0 ? 'Selisih vs invoice: 0' : `Selisih vs invoice: ${fmt(grandDiff)}`
            }
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{card.label}</div>
              <div className="text-lg font-semibold text-slate-900 mt-1 font-mono">{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.note}</div>
            </div>
          ))}
        </section>

        {/* TAB 1: Trace per invoice */}
        {activeTab === 'invoice-step' && (
          <div className="space-y-5">
            {invoiceSelector}

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 mb-2">Pilih produk</div>
              <div className="flex flex-wrap gap-2">
                {activeItems.map((item, idx) => {
                  const selected = idx === selectedProductIdx;
                  return (
                    <button
                      key={item.name + idx}
                      onClick={() => setSelectedProductIdx(idx)}
                      className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-semibold">{item.name || `Product ${idx + 1}`}</span>
                      <span className={selected ? 'text-slate-300' : 'text-slate-500'}>
                        {' '}
                        · {item.type} · {item.unit} · Qty {item.qty}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedItem && selectedRow && selectedCol && (
              <>
                <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {selectedItem.name} di {selectedCol.label}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Periode {formatDate(selectedCol.p!.s)} s/d {formatDate(selectedCol.p!.e)} (
                      {selectedCol.p!.days} hari) · faktor prorata f = {fmt9(selectedCol.p!.f)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Item grand total</div>
                    <div className="text-xl font-semibold font-mono text-slate-900">
                      {fmt(selectedRow.gt)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StepCard
                    no={1}
                    title="Price per unit"
                    desc={`Harga satuan dikalikan faktor prorata f (${fmt9(factor)}).`}
                    rule="Price × f"
                    calc={[`${fmt(selectedItem.price)} × ${fmt9(factor)} = ${fmt(selectedRow.pr)}`]}
                    result={fmt(selectedRow.pr)}
                  />
                  <StepCard
                    no={2}
                    title="Basic discount per unit"
                    desc={`Diskon dasar per unit (${
                      selectedItem.bt === 'Percentage' ? `${selectedItem.bv}%` : `nominal ${selectedItem.bv}`
                    }).`}
                    rule={selectedItem.bt === 'Percentage' ? 'Price per unit × %' : 'Basic discount × f'}
                    calc={[
                      selectedItem.bt === 'Percentage'
                        ? `${fmt(selectedRow.pr)} × ${selectedItem.bv}% = ${fmt(selectedRow.dc)}`
                        : `${fmt(selectedItem.bd)} × ${fmt9(factor)} = ${fmt(selectedRow.dc)}`
                    ]}
                    result={fmt(selectedRow.dc)}
                  />
                  <StepCard
                    no={3}
                    title="Net price per unit"
                    desc="Harga satuan dikurangi diskon dasar satuan."
                    rule="Price per unit − Basic discount per unit"
                    calc={[`${fmt(selectedRow.pr)} − ${fmt(selectedRow.dc)} = ${fmt(selectedRow.nt)}`]}
                    result={fmt(selectedRow.nt)}
                  />
                  <StepCard
                    no={4}
                    title="Total basic discount"
                    desc={`Diskon dasar per unit dikalikan Qty (${selectedItem.qty}).`}
                    rule="Basic discount per unit × Qty"
                    calc={[`${fmt(selectedRow.dc)} × ${selectedItem.qty} = ${fmt(selectedRow.tbd)}`]}
                    result={fmt(selectedRow.tbd)}
                  />
                  <StepCard
                    no={5}
                    title="Total after basic"
                    desc="Net price per unit dikalikan Qty, lalu dibulatkan ke bilangan bulat."
                    rule="Round(Net price per unit × Qty)"
                    calc={[
                      `${fmt(selectedRow.nt)} × ${selectedItem.qty} = ${(Number(selectedRow.nt) * selectedItem.qty).toFixed(2)}`,
                      `Round(${(Number(selectedRow.nt) * selectedItem.qty).toFixed(2)}) = ${fmt(selectedRow.tt)}`
                    ]}
                    result={fmt(selectedRow.tt)}
                    main
                  />
                  <StepCard
                    no={6}
                    title="Additional discount"
                    desc={`Diskon tambahan kontrak (${fmt(selectedItem.ad)}) dibagi rata sesuai durasi dan faktor prorata.`}
                    rule="Round(SO additional discount × f ÷ durasi)"
                    calc={[
                      `${fmt(selectedItem.ad)} × ${fmt9(factor)} ÷ ${selectedItem.dur} = ${fmt(selectedRow.ad)}`
                    ]}
                    result={fmt(selectedRow.ad)}
                  />
                </div>

                <StepCard
                  no={7}
                  title={`Item grand total di ${selectedCol.label}`}
                  desc={`Nilai bersih produk ini yang masuk ke pre-tax ${selectedCol.label}.`}
                  rule="Total after basic − Additional discount"
                  calc={[`${fmt(selectedRow.tt)} − ${fmt(selectedRow.ad)} = ${fmt(selectedRow.gt)}`]}
                  result={fmt(selectedRow.gt)}
                  main
                />
              </>
            )}
          </div>
        )}

        {/* TAB 2: Dasar SO */}
        {activeTab === 'so-base' && (
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900">Nilai dasar kontrak (SO)</h2>
              <p className="text-xs text-slate-500 mt-1">
                Nilai kontrak penuh tiap produk. Ini menjadi acuan yang dibandingkan dengan jumlah seluruh invoice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeItems.map((item, idx) => (
                <div
                  key={item.name + idx}
                  className="bg-white rounded-lg border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500">{item.type}</div>
                      <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                    </div>
                    <div className="text-xs text-slate-500 text-right">
                      {item.unit} · Qty {item.qty}
                    </div>
                  </div>

                  <dl className="text-xs font-mono space-y-2">
                    {[
                      ['Price per unit', fmt(item.price)],
                      [
                        `Basic discount (${item.bt === 'Percentage' ? `${item.bv}%` : item.bv}) per unit`,
                        fmt(item.bd)
                      ],
                      ['Net price per unit (Price − BD)', fmt(item.net)],
                      ['Durasi', `${item.dur} ${item.type === 'DR (Daily)' ? 'hari' : 'bulan'}`],
                      ['Total basic discount (BD × Qty × Durasi)', fmt(item.totalBasicDiscount)],
                      ['Total after basic ((Price − BD) × Qty × Durasi)', fmt(item.tt)],
                      [
                        `Additional discount (${item.at === 'Percentage' ? `${item.av}%` : item.av})`,
                        fmt(item.ad)
                      ]
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500 font-sans">{k}</dt>
                        <dd className="text-slate-900">{v}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 pt-1">
                      <dt className="font-sans font-semibold text-slate-900">Item grand total (SO)</dt>
                      <dd className="font-semibold text-slate-900">{fmt(item.gt)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Jadwal & Prorata */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900">Jadwal billing dan faktor prorata</h2>
              <p className="text-xs text-slate-500 mt-1">
                Konvensi 30/360: satu bulan penuh dihitung 30 hari (f = 1). Periode awal dan akhir yang tidak
                genap dihitung proporsional: f = jumlah hari ÷ 30.
              </p>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className={th}>Invoice</th>
                    <th className={th}>Mulai</th>
                    <th className={th}>Selesai</th>
                    <th className={`${th} text-right`}>Hari (30/360)</th>
                    <th className={`${th} text-right`}>Faktor f (hari ÷ 30)</th>
                    <th className={th}>Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                  {calculation.per.map((p, idx) => (
                    <tr key={idx}>
                      <td className={`${td} font-semibold font-sans`}>INV {idx + 1}</td>
                      <td className={td}>{formatDate(p.s)}</td>
                      <td className={td}>{formatDate(p.e)}</td>
                      <td className={`${td} text-right`}>{p.days}</td>
                      <td className={`${td} text-right`}>{fmt9(p.f)}</td>
                      <td className={`${td} font-sans text-slate-600`}>
                        {p.f !== 1 ? `Prorata (${p.days}/30)` : 'Satu bulan penuh'}
                        {p.last ? ' · periode terakhir' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Agregasi pajak & total */}
        {activeTab === 'aggregation' && selectedCol && (
          <div className="space-y-5">
            {invoiceSelector}

            <div className="bg-white rounded-lg border border-slate-200">
              <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Perhitungan total {selectedCol.label}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Pajak dan potongan pajak dibulatkan ke bilangan bulat per invoice.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Invoice grand total</div>
                  <div className="text-xl font-semibold font-mono text-slate-900">
                    {fmt(selectedCol.grand)}
                  </div>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className={`${th} w-12`}>No</th>
                    <th className={th}>Komponen</th>
                    <th className={th}>Perhitungan</th>
                    <th className={`${th} text-right`}>Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className={td}>1</td>
                    <td className={`${td} font-medium`}>One time total</td>
                    <td className={`${td} font-mono text-slate-600`}>{itemsOfType('One time')}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(selectedCol.one)}</td>
                  </tr>
                  <tr>
                    <td className={td}>2</td>
                    <td className={`${td} font-medium`}>Recurring total</td>
                    <td className={`${td} font-mono text-slate-600`}>{itemsOfType('Recurring')}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(selectedCol.rec)}</td>
                  </tr>
                  {activeItems.some(i => i.type === 'DR (Daily)') && (
                    <tr>
                      <td className={td}>3</td>
                      <td className={`${td} font-medium`}>DR (Daily) total</td>
                      <td className={`${td} font-mono text-slate-600`}>{itemsOfType('DR (Daily)')}</td>
                      <td className={`${td} text-right font-mono`}>{fmt(selectedCol.dr)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50">
                    <td className={td}>4</td>
                    <td className={`${td} font-semibold`}>Pre-tax total</td>
                    <td className={`${td} font-mono text-slate-600`}>
                      {fmt(selectedCol.one)} + {fmt(selectedCol.rec)}
                      {activeItems.some(i => i.type === 'DR (Daily)') ? ` + ${fmt(selectedCol.dr)}` : ''}
                    </td>
                    <td className={`${td} text-right font-mono font-semibold`}>{fmt(selectedCol.pre)}</td>
                  </tr>
                  <tr>
                    <td className={td}>5</td>
                    <td className={`${td} font-medium`}>Taxes and charges ({state.tx}%)</td>
                    <td className={`${td} font-mono text-slate-600`}>
                      Round({fmt(selectedCol.pre)} × {state.tx}%) = Round(
                      {((selectedCol.pre * (+state.tx || 0)) / 100).toFixed(2)})
                    </td>
                    <td className={`${td} text-right font-mono`}>{fmt(selectedCol.tax)}</td>
                  </tr>
                  {hasDeduction && (
                    <tr>
                      <td className={td}>6</td>
                      <td className={`${td} font-medium`}>Deducted taxes ({state.dx}%)</td>
                      <td className={`${td} font-mono text-slate-600`}>
                        Round({fmt(selectedCol.pre)} × {state.dx}%) = Round(
                        {((selectedCol.pre * (+state.dx || 0)) / 100).toFixed(2)})
                      </td>
                      <td className={`${td} text-right font-mono`}>− {fmt(selectedCol.ded)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-100">
                    <td className={td}>{hasDeduction ? 7 : 6}</td>
                    <td className={`${td} font-semibold`}>Invoice grand total</td>
                    <td className={`${td} font-mono text-slate-600`}>
                      {fmt(selectedCol.pre)} + {fmt(selectedCol.tax)}
                      {hasDeduction ? ` − ${fmt(selectedCol.ded)}` : ''}
                    </td>
                    <td className={`${td} text-right font-mono font-semibold text-slate-900`}>
                      {fmt(selectedCol.grand)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Rekonsiliasi seluruh invoice */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Rekonsiliasi seluruh invoice terhadap SO</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Difference = total semua invoice − nilai SO. Nilai tidak nol ditampilkan apa adanya.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-md">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className={th}>Komponen</th>
                      <th className={`${th} text-right`}>SO</th>
                      <th className={`${th} text-right`}>Total invoice</th>
                      <th className={`${th} text-right`}>Difference</th>
                      {cols.map(c => (
                        <th key={c.label} className={`${th} text-right`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                    {(
                      [
                        ['one', 'One time total'],
                        ['rec', 'Recurring total'],
                        ['pre', 'Pre-tax total'],
                        ['tax', `Taxes and charges (${state.tx}%)`],
                        ...(hasDeduction ? [['ded', `Deducted taxes (${state.dx}%)`]] : []),
                        ['grand', 'Invoice grand total']
                      ] as ['one' | 'rec' | 'pre' | 'tax' | 'ded' | 'grand', string][]
                    ).map(([key, label]) => {
                      const diff = diffOf(key);
                      const strong = key === 'pre' || key === 'grand';
                      return (
                        <tr key={key} className={strong ? 'bg-slate-50 font-semibold' : ''}>
                          <td className={`${td} font-sans`}>{label}</td>
                          <td className={`${td} text-right`}>{fmt(calculation.so[key] as number)}</td>
                          <td className={`${td} text-right`}>{fmt(sumCols(key))}</td>
                          <td className={`${td} text-right ${diff !== 0 ? 'font-bold underline' : ''}`}>
                            {fmt(diff)}
                          </td>
                          {cols.map(c => (
                            <td key={c.label} className={`${td} text-right`}>
                              {fmt(c[key] as number)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(diffOf('tax') !== 0 || diffOf('ded') !== 0) && (
                <p className="text-xs text-slate-600 border-l-2 border-slate-400 pl-3">
                  Selisih pada pajak berasal dari pembulatan per invoice: tiap invoice dibulatkan sendiri,
                  sedangkan pajak SO dibulatkan sekali dari total pre-tax. Selisih ini tidak disembunyikan.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
