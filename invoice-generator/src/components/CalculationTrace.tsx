import { useState } from 'react';
import { FiArrowLeft, FiMoon, FiSun } from 'react-icons/fi';

import type {
  InvoiceCalculatorState,
  CalculationResult,
  CalculatedProductItem,
  CalculatedProductPeriodRow,
  InvoiceFinancialSummary,
  ProductType,
  ThemeMode
} from '../types';
import {
  formatDateToDisplay,
  formatDisplayNumber,
  formatNumberWithNineDecimals,
  roundToNineDecimals
} from '../utils/calculator';

interface CalculationTraceProps {
  state: InvoiceCalculatorState;
  calculation: CalculationResult;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBack: () => void;
}

type TraceTabId = 'invoice-step' | 'so-base' | 'schedule' | 'aggregation';

type SummaryMetricKey =
  | 'oneTimeTotal'
  | 'recurringTotal'
  | 'dailyRateTotal'
  | 'preTaxTotal'
  | 'taxAmount'
  | 'deductedTaxAmount'
  | 'grandTotal';

const TRACE_TABS: { id: TraceTabId; label: string }[] = [
  { id: 'invoice-step', label: 'Trace per Invoice' },
  { id: 'so-base', label: 'Dasar SO' },
  { id: 'schedule', label: 'Jadwal & Prorata' },
  { id: 'aggregation', label: 'Agregasi Pajak & Total' }
];

function sumInvoiceColumnsByMetric(
  invoiceColumns: InvoiceFinancialSummary[],
  metricKey: SummaryMetricKey
): number {
  return roundToNineDecimals(
    invoiceColumns.reduce((accumulator, column) => accumulator + (column[metricKey] as number), 0)
  );
}

function calculateDifferenceFromSalesOrder(
  invoiceColumns: InvoiceFinancialSummary[],
  salesOrderSummary: InvoiceFinancialSummary,
  metricKey: SummaryMetricKey
): number {
  return roundToNineDecimals(
    sumInvoiceColumnsByMetric(invoiceColumns, metricKey) - (salesOrderSummary[metricKey] as number)
  );
}

function formatProductContributionList(
  activeItems: CalculatedProductItem[],
  productType: ProductType,
  invoiceIndex: number
): string {
  const matchingItems = activeItems.filter(item => item.type === productType);
  if (!matchingItems.length) return 'Tidak ada produk';
  return matchingItems
    .map(item => `${item.name} (${formatDisplayNumber(item.periodRows[invoiceIndex]?.grandTotal)})`)
    .join(' + ');
}

function StepCard({
  stepNumber,
  title,
  description,
  formulaRule,
  calculationLines,
  resultValue,
  isHighlighted = false
}: {
  stepNumber: number;
  title: string;
  description: string;
  formulaRule: string;
  calculationLines: string[];
  resultValue: string;
  isHighlighted?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-lg border p-5 space-y-3 transition-colors ${
        isHighlighted
          ? 'border-slate-900 dark:border-indigo-400'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-indigo-600 text-xs font-semibold text-white">
            {stepNumber}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Hasil</div>
          <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {resultValue}
          </div>
        </div>
      </div>
      <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 font-mono text-xs space-y-1">
        <div className="text-slate-500 dark:text-slate-400">Rumus: {formulaRule}</div>
        {calculationLines.map((line, index) => (
          <div key={index} className="text-slate-900 dark:text-slate-200">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalculationTrace({
  state,
  calculation,
  theme,
  onToggleTheme,
  onBack
}: CalculationTraceProps) {
  const [activeTab, setActiveTab] = useState<TraceTabId>('invoice-step');
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState<number>(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(3);

  const activeItems = calculation.activeCalculatedItems;
  const invoiceColumns = calculation.invoiceColumns;
  const selectedColumn: InvoiceFinancialSummary | undefined =
    invoiceColumns[selectedInvoiceIndex] || invoiceColumns[0];
  const selectedItem: CalculatedProductItem | undefined =
    activeItems[selectedProductIndex] || activeItems[0];
  const selectedPeriodRow: CalculatedProductPeriodRow | undefined =
    selectedItem?.periodRows[selectedInvoiceIndex];

  const proRataFactor = selectedColumn?.period?.proRataFactor ?? 1;
  const hasDeductedTax = Number(state.deductedTaxRatePercent) > 0;
  const grandTotalDifference = calculateDifferenceFromSalesOrder(
    invoiceColumns,
    calculation.salesOrderSummary,
    'grandTotal'
  );

  const tableHeaderClass = 'px-4 py-3 font-medium';
  const tableCellClass = 'px-4 py-3';

  function renderInvoiceSelector() {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Pilih invoice</div>
        <div className="flex flex-wrap gap-2">
          {invoiceColumns.map((column, index) => {
            const isSelected = index === selectedInvoiceIndex;
            return (
              <button
                key={column.label}
                onClick={() => setSelectedInvoiceIndex(index)}
                className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="font-semibold">{column.label}</span>
                {column.period && (
                  <span className={isSelected ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'}>
                    {' '}
                    · {column.period.days} hari{column.period.proRataFactor !== 1 ? ' (prorata)' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-20 transition-colors">
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kembali ke Generator"
            >
              <FiArrowLeft size={15} />
              <span>Kembali ke Generator</span>
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Trace Perhitungan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Penelusuran rumus dan alokasi periode invoice, langkah demi langkah
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {TRACE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <FiSun size={15} className="text-amber-400" /> : <FiMoon size={15} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: 'Durasi kontrak',
              value: `${calculation.recurringDurationMonths} bulan`,
              note: `${state.startDate} s/d ${state.endDate}`
            },
            {
              label: 'Jumlah invoice',
              value: `${invoiceColumns.length}`,
              note: `Siklus tanggal ${state.cycleDay || '-'}`
            },
            {
              label: 'Produk aktif',
              value: `${activeItems.length}`,
              note: 'Item dengan harga terisi'
            },
            {
              label: 'Pre-tax SO',
              value: formatDisplayNumber(calculation.salesOrderSummary.preTaxTotal),
              note: 'Sebelum pajak'
            },
            {
              label: 'Grand total SO',
              value: formatDisplayNumber(calculation.salesOrderSummary.grandTotal),
              note:
                grandTotalDifference === 0
                  ? 'Selisih vs invoice: 0'
                  : `Selisih vs invoice: ${formatDisplayNumber(grandTotalDifference)}`
            }
          ].map(card => (
            <div
              key={card.label}
              className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{card.label}</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {card.value}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.note}</div>
            </div>
          ))}
        </section>

        {activeTab === 'invoice-step' && (
          <div className="space-y-5">
            {renderInvoiceSelector()}

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Pilih produk</div>
              <div className="flex flex-wrap gap-2">
                {activeItems.map((item, index) => {
                  const isSelected = index === selectedProductIndex;
                  return (
                    <button
                      key={item.name + index}
                      onClick={() => setSelectedProductIndex(index)}
                      className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-semibold">{item.name || `Product ${index + 1}`}</span>
                      <span className={isSelected ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'}>
                        {' '}
                        · {item.type} · {item.unit} · Qty {item.quantity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedItem && selectedPeriodRow && selectedColumn && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {selectedItem.name} di {selectedColumn.label}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Periode {formatDateToDisplay(selectedColumn.period!.startDate)} s/d{' '}
                      {formatDateToDisplay(selectedColumn.period!.endDate)} ({selectedColumn.period!.days}{' '}
                      hari) · faktor prorata f = {formatNumberWithNineDecimals(selectedColumn.period!.proRataFactor)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Item grand total</div>
                    <div className="text-xl font-semibold font-mono text-slate-900 dark:text-slate-100">
                      {formatDisplayNumber(selectedPeriodRow.grandTotal)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StepCard
                    stepNumber={1}
                    title="Price per unit"
                    description={`Harga satuan dikalikan faktor prorata f (${formatNumberWithNineDecimals(proRataFactor)}).`}
                    formulaRule="Price × f"
                    calculationLines={[
                      `${formatDisplayNumber(selectedItem.price)} × ${formatNumberWithNineDecimals(proRataFactor)} = ${formatDisplayNumber(selectedPeriodRow.unitPrice)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.unitPrice)}
                  />
                  <StepCard
                    stepNumber={2}
                    title="Basic discount per unit"
                    description={`Diskon dasar per unit (${
                      selectedItem.basicDiscountType === 'Percentage'
                        ? `${selectedItem.basicDiscountValue}%`
                        : `nominal ${selectedItem.basicDiscountValue}`
                    }).`}
                    formulaRule={
                      selectedItem.basicDiscountType === 'Percentage'
                        ? 'Price per unit × %'
                        : 'Basic discount × f'
                    }
                    calculationLines={[
                      selectedItem.basicDiscountType === 'Percentage'
                        ? `${formatDisplayNumber(selectedPeriodRow.unitPrice)} × ${selectedItem.basicDiscountValue}% = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit)}`
                        : `${formatDisplayNumber(selectedItem.basicDiscountPerUnit)} × ${formatNumberWithNineDecimals(proRataFactor)} = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit)}
                  />
                  <StepCard
                    stepNumber={3}
                    title="Net price per unit"
                    description="Harga satuan dikurangi diskon dasar satuan."
                    formulaRule="Price per unit − Basic discount per unit"
                    calculationLines={[
                      `${formatDisplayNumber(selectedPeriodRow.unitPrice)} − ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit)} = ${formatDisplayNumber(selectedPeriodRow.netPricePerUnit)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.netPricePerUnit)}
                  />
                  <StepCard
                    stepNumber={4}
                    title="Total basic discount"
                    description={`Diskon dasar per unit dikalikan Qty (${selectedItem.quantity}).`}
                    formulaRule="Basic discount per unit × Qty"
                    calculationLines={[
                      `${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit)} × ${selectedItem.quantity} = ${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}
                  />
                  <StepCard
                    stepNumber={5}
                    title="Total after basic"
                    description="Net price per unit dikalikan Qty, lalu dibulatkan ke bilangan bulat."
                    formulaRule="Round(Net price per unit × Qty)"
                    calculationLines={[
                      `${formatDisplayNumber(selectedPeriodRow.netPricePerUnit)} × ${selectedItem.quantity} = ${(Number(selectedPeriodRow.netPricePerUnit) * selectedItem.quantity).toFixed(2)}`,
                      `Round(${(Number(selectedPeriodRow.netPricePerUnit) * selectedItem.quantity).toFixed(2)}) = ${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}
                    isHighlighted
                  />
                  <StepCard
                    stepNumber={6}
                    title="Additional discount"
                    description={`Diskon tambahan kontrak (${formatDisplayNumber(selectedItem.additionalDiscountAmount)}) dibagi rata sesuai durasi dan faktor prorata.`}
                    formulaRule="Round(SO additional discount × f ÷ durasi)"
                    calculationLines={[
                      `${formatDisplayNumber(selectedItem.additionalDiscountAmount)} × ${formatNumberWithNineDecimals(proRataFactor)} ÷ ${selectedItem.duration} = ${formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)}
                  />
                </div>

                <StepCard
                  stepNumber={7}
                  title={`Item grand total di ${selectedColumn.label}`}
                  description={`Nilai bersih produk ini yang masuk ke pre-tax ${selectedColumn.label}.`}
                  formulaRule="Total after basic − Additional discount"
                  calculationLines={[
                    `${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)} − ${formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)} = ${formatDisplayNumber(selectedPeriodRow.grandTotal)}`
                  ]}
                  resultValue={formatDisplayNumber(selectedPeriodRow.grandTotal)}
                  isHighlighted
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'so-base' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Nilai dasar kontrak (SO)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Nilai kontrak penuh tiap produk. Ini menjadi acuan yang dibandingkan dengan jumlah seluruh invoice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeItems.map((item, index) => (
                <div
                  key={item.name + index}
                  className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.type}</div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                      {item.unit} · Qty {item.quantity}
                    </div>
                  </div>

                  <dl className="text-xs font-mono space-y-2">
                    {[
                      ['Price per unit', formatDisplayNumber(item.price)],
                      [
                        `Basic discount (${item.basicDiscountType === 'Percentage' ? `${item.basicDiscountValue}%` : item.basicDiscountValue}) per unit`,
                        formatDisplayNumber(item.basicDiscountPerUnit)
                      ],
                      ['Net price per unit (Price − BD)', formatDisplayNumber(item.netPricePerUnit)],
                      ['Durasi', `${item.duration} ${item.type === 'DR (Daily)' ? 'hari' : 'bulan'}`],
                      ['Total basic discount (BD × Qty × Durasi)', formatDisplayNumber(item.totalBasicDiscount)],
                      [
                        'Total after basic ((Price − BD) × Qty × Durasi)',
                        formatDisplayNumber(item.totalAfterBasicDiscount)
                      ],
                      [
                        `Additional discount (${item.additionalDiscountType === 'Percentage' ? `${item.additionalDiscountValue}%` : item.additionalDiscountValue})`,
                        formatDisplayNumber(item.additionalDiscountAmount)
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2"
                      >
                        <dt className="text-slate-500 dark:text-slate-400 font-sans">{label}</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{value}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 pt-1">
                      <dt className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                        Item grand total (SO)
                      </dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDisplayNumber(item.grandTotal)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Jadwal billing dan faktor prorata
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Konvensi 30/360: satu bulan penuh dihitung 30 hari (f = 1). Periode awal dan akhir yang tidak
                genap dihitung proporsional: f = jumlah hari ÷ 30.
              </p>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className={tableHeaderClass}>Invoice</th>
                    <th className={tableHeaderClass}>Mulai</th>
                    <th className={tableHeaderClass}>Selesai</th>
                    <th className={`${tableHeaderClass} text-right`}>Hari (30/360)</th>
                    <th className={`${tableHeaderClass} text-right`}>Faktor f (hari ÷ 30)</th>
                    <th className={tableHeaderClass}>Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                  {calculation.billingPeriods.map((period, index) => (
                    <tr key={index}>
                      <td className={`${tableCellClass} font-semibold font-sans`}>INV {index + 1}</td>
                      <td className={tableCellClass}>{formatDateToDisplay(period.startDate)}</td>
                      <td className={tableCellClass}>{formatDateToDisplay(period.endDate)}</td>
                      <td className={`${tableCellClass} text-right`}>{period.days}</td>
                      <td className={`${tableCellClass} text-right`}>
                        {formatNumberWithNineDecimals(period.proRataFactor)}
                      </td>
                      <td className={`${tableCellClass} font-sans text-slate-600 dark:text-slate-400`}>
                        {period.proRataFactor !== 1 ? `Prorata (${period.days}/30)` : 'Satu bulan penuh'}
                        {period.isLastPeriod ? ' · periode terakhir' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'aggregation' && selectedColumn && (
          <div className="space-y-5">
            {renderInvoiceSelector()}

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Perhitungan total {selectedColumn.label}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Pajak dan potongan pajak dibulatkan ke bilangan bulat per invoice.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Invoice grand total</div>
                  <div className="text-xl font-semibold font-mono text-slate-900 dark:text-slate-100">
                    {formatDisplayNumber(selectedColumn.grandTotal)}
                  </div>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className={`${tableHeaderClass} w-12`}>No</th>
                    <th className={tableHeaderClass}>Komponen</th>
                    <th className={tableHeaderClass}>Perhitungan</th>
                    <th className={`${tableHeaderClass} text-right`}>Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  <tr>
                    <td className={tableCellClass}>1</td>
                    <td className={`${tableCellClass} font-medium`}>One time total</td>
                    <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                      {formatProductContributionList(activeItems, 'One time', selectedInvoiceIndex)}
                    </td>
                    <td className={`${tableCellClass} text-right font-mono`}>
                      {formatDisplayNumber(selectedColumn.oneTimeTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className={tableCellClass}>2</td>
                    <td className={`${tableCellClass} font-medium`}>Recurring total</td>
                    <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                      {formatProductContributionList(activeItems, 'Recurring', selectedInvoiceIndex)}
                    </td>
                    <td className={`${tableCellClass} text-right font-mono`}>
                      {formatDisplayNumber(selectedColumn.recurringTotal)}
                    </td>
                  </tr>
                  {activeItems.some(item => item.type === 'DR (Daily)') && (
                    <tr>
                      <td className={tableCellClass}>3</td>
                      <td className={`${tableCellClass} font-medium`}>DR (Daily) total</td>
                      <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                        {formatProductContributionList(activeItems, 'DR (Daily)', selectedInvoiceIndex)}
                      </td>
                      <td className={`${tableCellClass} text-right font-mono`}>
                        {formatDisplayNumber(selectedColumn.dailyRateTotal)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 dark:bg-slate-800/60">
                    <td className={tableCellClass}>4</td>
                    <td className={`${tableCellClass} font-semibold`}>Pre-tax total</td>
                    <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                      {formatDisplayNumber(selectedColumn.oneTimeTotal)} +{' '}
                      {formatDisplayNumber(selectedColumn.recurringTotal)}
                      {activeItems.some(item => item.type === 'DR (Daily)')
                        ? ` + ${formatDisplayNumber(selectedColumn.dailyRateTotal)}`
                        : ''}
                    </td>
                    <td className={`${tableCellClass} text-right font-mono font-semibold`}>
                      {formatDisplayNumber(selectedColumn.preTaxTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className={tableCellClass}>5</td>
                    <td className={`${tableCellClass} font-medium`}>
                      Taxes and charges ({state.taxRatePercent}%)
                    </td>
                    <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                      Round({formatDisplayNumber(selectedColumn.preTaxTotal)} × {state.taxRatePercent}%) =
                      Round({((selectedColumn.preTaxTotal * (Number(state.taxRatePercent) || 0)) / 100).toFixed(2)})
                    </td>
                    <td className={`${tableCellClass} text-right font-mono`}>
                      {formatDisplayNumber(selectedColumn.taxAmount)}
                    </td>
                  </tr>
                  {hasDeductedTax && (
                    <tr>
                      <td className={tableCellClass}>6</td>
                      <td className={`${tableCellClass} font-medium`}>
                        Deducted taxes ({state.deductedTaxRatePercent}%)
                      </td>
                      <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                        Round({formatDisplayNumber(selectedColumn.preTaxTotal)} × {state.deductedTaxRatePercent}
                        %) = Round(
                        {((selectedColumn.preTaxTotal * (Number(state.deductedTaxRatePercent) || 0)) / 100).toFixed(2)}
                        )
                      </td>
                      <td className={`${tableCellClass} text-right font-mono`}>
                        − {formatDisplayNumber(selectedColumn.deductedTaxAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <td className={tableCellClass}>{hasDeductedTax ? 7 : 6}</td>
                    <td className={`${tableCellClass} font-semibold`}>Invoice grand total</td>
                    <td className={`${tableCellClass} font-mono text-slate-600 dark:text-slate-400`}>
                      {formatDisplayNumber(selectedColumn.preTaxTotal)} +{' '}
                      {formatDisplayNumber(selectedColumn.taxAmount)}
                      {hasDeductedTax ? ` − ${formatDisplayNumber(selectedColumn.deductedTaxAmount)}` : ''}
                    </td>
                    <td className={`${tableCellClass} text-right font-mono font-semibold text-slate-900 dark:text-slate-100`}>
                      {formatDisplayNumber(selectedColumn.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Rekonsiliasi seluruh invoice terhadap SO
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Difference = total semua invoice − nilai SO. Nilai tidak nol ditampilkan apa adanya.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className={tableHeaderClass}>Komponen</th>
                      <th className={`${tableHeaderClass} text-right`}>SO</th>
                      <th className={`${tableHeaderClass} text-right`}>Total invoice</th>
                      <th className={`${tableHeaderClass} text-right`}>Difference</th>
                      {invoiceColumns.map(column => (
                        <th key={column.label} className={`${tableHeaderClass} text-right`}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                    {(
                      [
                        ['oneTimeTotal', 'One time total'],
                        ['recurringTotal', 'Recurring total'],
                        ['preTaxTotal', 'Pre-tax total'],
                        ['taxAmount', `Taxes and charges (${state.taxRatePercent}%)`],
                        ...(hasDeductedTax
                          ? [['deductedTaxAmount', `Deducted taxes (${state.deductedTaxRatePercent}%)`]]
                          : []),
                        ['grandTotal', 'Invoice grand total']
                      ] as [SummaryMetricKey, string][]
                    ).map(([metricKey, label]) => {
                      const difference = calculateDifferenceFromSalesOrder(
                        invoiceColumns,
                        calculation.salesOrderSummary,
                        metricKey
                      );
                      const isStrongRow = metricKey === 'preTaxTotal' || metricKey === 'grandTotal';
                      return (
                        <tr
                          key={metricKey}
                          className={isStrongRow ? 'bg-slate-50 dark:bg-slate-800/50 font-semibold' : ''}
                        >
                          <td className={`${tableCellClass} font-sans`}>{label}</td>
                          <td className={`${tableCellClass} text-right`}>
                            {formatDisplayNumber(calculation.salesOrderSummary[metricKey] as number)}
                          </td>
                          <td className={`${tableCellClass} text-right`}>
                            {formatDisplayNumber(sumInvoiceColumnsByMetric(invoiceColumns, metricKey))}
                          </td>
                          <td
                            className={`${tableCellClass} text-right ${
                              difference !== 0 ? 'font-bold underline' : ''
                            }`}
                          >
                            {formatDisplayNumber(difference)}
                          </td>
                          {invoiceColumns.map(column => (
                            <td key={column.label} className={`${tableCellClass} text-right`}>
                              {formatDisplayNumber(column[metricKey] as number)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(calculateDifferenceFromSalesOrder(
                invoiceColumns,
                calculation.salesOrderSummary,
                'taxAmount'
              ) !== 0 ||
                calculateDifferenceFromSalesOrder(
                  invoiceColumns,
                  calculation.salesOrderSummary,
                  'deductedTaxAmount'
                ) !== 0) && (
                <p className="text-xs text-slate-600 dark:text-slate-400 border-l-2 border-slate-400 dark:border-slate-600 pl-3">
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
