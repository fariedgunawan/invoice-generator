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
  convertDateToSerialDays,
  convertSerialDaysToDate,
  formatDateToDisplay,
  formatDisplayNumber,
  formatNumberWithNineDecimals,
  parseDateString,
  roundToNineDecimals
} from '../utils/calculator';

interface CalculationTraceProps {
  state: InvoiceCalculatorState;
  calculation: CalculationResult;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBack: () => void;
}

type TraceTabId = 'timeline' | 'invoice-step' | 'so-base' | 'schedule' | 'aggregation';

type SummaryMetricKey =
  | 'oneTimeTotal'
  | 'recurringTotal'
  | 'dailyRateTotal'
  | 'preTaxTotal'
  | 'taxAmount'
  | 'deductedTaxAmount'
  | 'grandTotal';

const TRACE_TABS: { id: TraceTabId; label: string }[] = [
  { id: 'timeline', label: 'Simulasi Timeline & Terminate' },
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
  const [activeTab, setActiveTab] = useState<TraceTabId>('timeline');
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState<number>(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0);

  const allItems = calculation.allCalculatedItems;
  const activeItems = calculation.activeCalculatedItems;
  const invoiceColumns = calculation.invoiceColumns;
  const selectedColumn: InvoiceFinancialSummary | undefined =
    invoiceColumns[selectedInvoiceIndex] || invoiceColumns[0];
  const selectedItem: CalculatedProductItem | undefined =
    activeItems[selectedProductIndex] || activeItems[0];
  const selectedPeriodRow: CalculatedProductPeriodRow | undefined =
    selectedItem?.periodRows[selectedInvoiceIndex];

  const proRataFactor = selectedPeriodRow?.proRataFactor ?? selectedColumn?.period?.proRataFactor ?? 1;
  const hasDeductedTax = Number(state.deductedTaxRatePercent) > 0;
  const grandTotalDifference = calculateDifferenceFromSalesOrder(
    invoiceColumns,
    calculation.salesOrderSummary,
    'grandTotal'
  );

  const contractStartSerial = convertDateToSerialDays(parseDateString(state.startDate));
  const contractEndSerial = convertDateToSerialDays(parseDateString(state.endDate));
  const totalContractSerialSpan = Math.max(1, contractEndSerial - contractStartSerial + 1);

  const activeBillColumns = invoiceColumns.filter(column => column.grandTotal > 0);
  const activeBillCount = activeBillColumns.length;
  const lastActiveInvoiceColumn =
    activeBillColumns.length > 0 ? activeBillColumns[activeBillColumns.length - 1] : undefined;

  function evaluateSalesOrderStatusAtNode(periodIndex: number): {
    status: 'Acknowledge By' | 'Terminated';
    lastInvoiceDateDisplay: string;
    nextInvoiceDateDisplay: string;
    reasons: string[];
  } {
    const column = invoiceColumns[periodIndex];
    if (!column?.period) {
      return {
        status: 'Acknowledge By',
        lastInvoiceDateDisplay: '-',
        nextInvoiceDateDisplay: '-',
        reasons: []
      };
    }

    const lastInvoiceSerial = convertDateToSerialDays(column.period.startDate);
    const nextColumn = invoiceColumns[periodIndex + 1];
    const nextInvoiceDateObject = nextColumn?.period
      ? nextColumn.period.startDate
      : convertSerialDaysToDate(convertDateToSerialDays(column.period.endDate) + 1);
    const nextInvoiceSerial = convertDateToSerialDays(nextInvoiceDateObject);

    let hasActiveItemAfterNode = false;
    const reasons: string[] = [];

    allItems.forEach(item => {
      if (item.status === 'Delete') {
        reasons.push(`${item.name}: Status = Delete (diabaikan)`);
        return;
      }
      if (item.status === 'Production' || item.status === 'Suspend') {
        hasActiveItemAfterNode = true;
        reasons.push(`${item.name}: Status = ${item.status} (masih aktif ditagih)`);
        return;
      }
      if (item.status === 'Terminate') {
        const termDateString = (item.terminateDate || '').trim();
        if (!termDateString) {
          hasActiveItemAfterNode = true;
          reasons.push(`${item.name}: Status = Terminate tanpa tanggal (masih aktif)`);
          return;
        }
        const termSerial = convertDateToSerialDays(parseDateString(termDateString));
        if (termSerial <= lastInvoiceSerial) {
          reasons.push(
            `${item.name}: Terminate (${formatDateToDisplay(parseDateString(termDateString))}) <= Last Invoice (${formatDateToDisplay(column.period!.startDate)}) -> Selesai`
          );
        } else if (termSerial > lastInvoiceSerial && termSerial < nextInvoiceSerial) {
          reasons.push(
            `${item.name}: Terminate (${formatDateToDisplay(parseDateString(termDateString))}) di antara Last Invoice & Next Invoice (${formatDateToDisplay(nextInvoiceDateObject)}) -> Tagihan Terakhir (Prorata)`
          );
        } else {
          hasActiveItemAfterNode = true;
          reasons.push(
            `${item.name}: Terminate (${formatDateToDisplay(parseDateString(termDateString))}) >= Next Invoice (${formatDateToDisplay(nextInvoiceDateObject)}) -> Masih ditagih di periode berikutnya`
          );
        }
      }
    });

    const hasAnyNonDeletedItem = allItems.some(item => item.status !== 'Delete');
    const evaluatedStatus =
      !hasAnyNonDeletedItem || hasActiveItemAfterNode ? 'Acknowledge By' : 'Terminated';

    return {
      status: evaluatedStatus,
      lastInvoiceDateDisplay: formatDateToDisplay(column.period.startDate),
      nextInvoiceDateDisplay: formatDateToDisplay(nextInvoiceDateObject),
      reasons
    };
  }

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
                    {activeItems.some(item => item.periodRows[index]?.isFullContractRemainderAbsorbed)
                      ? ' · Hitung Mundur'
                      : ''}
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
              note: 'Selain status Delete'
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

        {activeTab === 'timeline' && (() => {
          const spanDays = totalContractSerialSpan;
          const toPercent = (serial: number) => ((serial - contractStartSerial) / spanDays) * 100;
          const segmentStyle = (startSerial: number, endSerial: number) => ({
            left: `${toPercent(startSerial)}%`,
            width: `${((endSerial - startSerial + 1) / spanDays) * 100}%`
          });
          const terminatePercent = (dateString: string) =>
            Math.max(0, Math.min(100, toPercent(convertDateToSerialDays(parseDateString(dateString)) + 1)));
          const labelAlignClass = (percent: number) =>
            percent > 80 ? '-translate-x-full' : percent < 20 ? 'translate-x-0' : '-translate-x-1/2';

          const fullBillClass = 'bg-indigo-600 dark:bg-indigo-500 text-white';
          const partialBillClass = 'bg-indigo-300 dark:bg-indigo-400/70 text-indigo-950 dark:text-white';
          const idleTrackClass = 'bg-slate-100 dark:bg-slate-800';
          const cardClass =
            'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800';
          const mutedText = 'text-slate-500 dark:text-slate-400';

          const terminatedItems = allItems.filter(
            item => item.status === 'Terminate' && (item.terminateDate || '').trim()
          );
          const terminateDateGroups = Array.from(
            new Set(terminatedItems.map(item => item.terminateDate))
          ).sort();

          const periodHasPartialBill = (periodIndex: number) =>
            allItems.some(
              item =>
                item.status === 'Terminate' &&
                item.periodRows[periodIndex]?.isUnitPriceProrated &&
                item.periodRows[periodIndex].grandTotal > 0
            );

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className={`${cardClass} p-4`}>
                  <div className={`text-xs font-medium ${mutedText}`}>Jumlah bill terbentuk</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono text-slate-900 dark:text-slate-100">
                      {activeBillCount}
                    </span>
                    <span className={`text-xs font-mono ${mutedText}`}>
                      dari {invoiceColumns.length} periode
                    </span>
                  </div>
                  <div className={`text-xs mt-1 ${mutedText}`}>
                    {invoiceColumns.length - activeBillCount > 0
                      ? `${invoiceColumns.length - activeBillCount} periode tidak ditagih setelah Terminate`
                      : 'Semua periode menghasilkan tagihan'}
                  </div>
                </div>

                <div className={`${cardClass} p-4`}>
                  <div className={`text-xs font-medium ${mutedText}`}>Penagihan berjalan sampai</div>
                  <div className="mt-1 text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                    {lastActiveInvoiceColumn?.period
                      ? `${lastActiveInvoiceColumn.label} · ${formatDateToDisplay(lastActiveInvoiceColumn.period.endDate)}`
                      : 'Tidak ada tagihan'}
                  </div>
                  <div className={`text-xs mt-1 ${mutedText}`}>
                    Kontrak {formatDateToDisplay(parseDateString(state.startDate))} s/d{' '}
                    {formatDateToDisplay(parseDateString(state.endDate))}
                  </div>
                </div>

                <div className={`${cardClass} p-4`}>
                  <div className={`text-xs font-medium ${mutedText}`}>Total bill vs nilai SO</div>
                  <div className="mt-1 text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                    {formatDisplayNumber(sumInvoiceColumnsByMetric(invoiceColumns, 'grandTotal'))}
                  </div>
                  <div className={`text-xs mt-1 font-mono ${mutedText}`}>
                    SO: {formatDisplayNumber(calculation.salesOrderSummary.grandTotal)}
                  </div>
                </div>

                <div className={`${cardClass} p-4`}>
                  <div className={`text-xs font-medium ${mutedText}`}>Status item</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Aktif', allItems.filter(item => item.status === 'Production' || item.status === 'Suspend').length],
                      ['Terminate', allItems.filter(item => item.status === 'Terminate').length],
                      ['Delete', allItems.filter(item => item.status === 'Delete').length]
                    ].map(([label, count]) => (
                      <div key={label} className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1">
                        <div className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                          {count}
                        </div>
                        <div className={`text-[10px] ${mutedText}`}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${cardClass} p-5 space-y-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Timeline penagihan kontrak
                    </h3>
                    <p className={`text-xs mt-0.5 ${mutedText}`}>
                      Lebar tiap segmen sebanding dengan jumlah hari periode. Garis vertikal menandai tanggal Terminate.
                    </p>
                  </div>
                  <div className={`flex flex-wrap items-center gap-4 text-xs ${mutedText}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-5 rounded-sm bg-indigo-600 dark:bg-indigo-500" />
                      Periode penuh
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-5 rounded-sm bg-indigo-300 dark:bg-indigo-400/70" />
                      Prorata Terminate
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-5 rounded-sm bg-slate-200 dark:bg-slate-700" />
                      Tidak ditagih
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3.5 w-0.5 bg-slate-900 dark:bg-slate-100" />
                      Tanggal Terminate
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto pb-1">
                  <div className="min-w-[820px]">
                    <div className="relative pt-9">
                      {terminateDateGroups.map(dateString => {
                        const percent = terminatePercent(dateString);
                        const names = terminatedItems
                          .filter(item => item.terminateDate === dateString)
                          .map(item => item.name);
                        return (
                          <div
                            key={dateString}
                            style={{ left: `${percent}%`, top: 0 }}
                            className="absolute bottom-0 z-20 w-0 pointer-events-none"
                          >
                            <div
                              className={`absolute top-0 ${labelAlignClass(percent)} whitespace-nowrap rounded-md bg-slate-900 dark:bg-slate-100 px-2 py-1 text-[10px] font-mono font-medium text-white dark:text-slate-900 shadow-sm`}
                            >
                              Terminate {formatDateToDisplay(parseDateString(dateString))}
                              <span className="opacity-70"> · {names.length} item</span>
                            </div>
                            <div className="absolute top-6 bottom-0 -translate-x-1/2 w-0.5 bg-slate-900 dark:bg-slate-100" />
                          </div>
                        );
                      })}

                      <div className={`relative h-12 rounded-md overflow-hidden ${idleTrackClass}`}>
                        {invoiceColumns.map((column, index) => {
                          const period = column.period;
                          if (!period) return null;
                          const isBillActive = column.grandTotal > 0;
                          const isPartial = periodHasPartialBill(index);
                          const isSelected = index === selectedInvoiceIndex;
                          return (
                            <button
                              key={column.label}
                              type="button"
                              onClick={() => setSelectedInvoiceIndex(index)}
                              style={segmentStyle(
                                convertDateToSerialDays(period.startDate),
                                convertDateToSerialDays(period.endDate)
                              )}
                              className={`absolute inset-y-0 flex flex-col items-center justify-center border-r border-white dark:border-slate-900 cursor-pointer transition-colors ${
                                isBillActive
                                  ? isPartial
                                    ? partialBillClass
                                    : fullBillClass
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              } ${
                                isSelected
                                  ? 'ring-2 ring-inset ring-slate-900 dark:ring-white'
                                  : 'hover:brightness-95 dark:hover:brightness-110'
                              }`}
                            >
                              <span className="text-xs font-semibold">{column.label}</span>
                              <span className="text-[10px] font-mono opacity-80">{period.days} hari</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {invoiceColumns.map((column, index) => {
                    const period = column.period;
                    const isBillActive = column.grandTotal > 0;
                    const isSelected = index === selectedInvoiceIndex;
                    const evaluation = evaluateSalesOrderStatusAtNode(index);
                    const terminatingHere = allItems.filter(item => {
                      if (item.status !== 'Terminate' || !(item.terminateDate || '').trim() || !period) return false;
                      const termSerial = convertDateToSerialDays(parseDateString(item.terminateDate));
                      return (
                        termSerial >= convertDateToSerialDays(period.startDate) &&
                        termSerial <= convertDateToSerialDays(period.endDate)
                      );
                    });
                    return (
                      <button
                        key={column.label}
                        type="button"
                        onClick={() => setSelectedInvoiceIndex(index)}
                        className={`text-left rounded-lg border p-3 space-y-2 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-950 ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-600 dark:ring-indigo-400'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {column.label}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              isBillActive
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isBillActive ? `Bill ke-${index + 1}` : 'Tidak ditagih'}
                          </span>
                        </div>
                        {period && (
                          <div className={`text-[11px] font-mono ${mutedText}`}>
                            {formatDateToDisplay(period.startDate)} - {formatDateToDisplay(period.endDate)}
                          </div>
                        )}
                        <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatDisplayNumber(column.grandTotal)}
                        </div>
                        {period && (
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            {period.days} hari · f = {formatNumberWithNineDecimals(period.proRataFactor)}
                          </div>
                        )}
                        {terminatingHere.length > 0 && (
                          <div className="text-[10px] text-slate-700 dark:text-slate-300 border-l-2 border-slate-900 dark:border-slate-100 pl-2">
                            Terminate: {terminatingHere.map(item => item.name).join(', ')}
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-[10px]">
                          <span className={mutedText}>Status SO</span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ${
                              evaluation.status === 'Terminated'
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}
                          >
                            {evaluation.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`${cardClass} p-5 space-y-5`}>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Penagihan per produk
                  </h3>
                  <p className={`text-xs mt-0.5 ${mutedText}`}>
                    Bar terisi menunjukkan rentang tanggal yang ditagih; area kosong setelah garis Terminate tidak ditagih.
                  </p>
                </div>

                <div className="space-y-4">
                  {allItems.map((item, itemIdx) => {
                    const isDeleted = item.status === 'Delete';
                    const hasTerminateDate =
                      item.status === 'Terminate' && Boolean((item.terminateDate || '').trim());
                    const terminateLinePercent = hasTerminateDate ? terminatePercent(item.terminateDate) : null;
                    const itemActiveBills = isDeleted
                      ? 0
                      : item.periodRows.filter(row => row.grandTotal > 0).length;
                    const itemTotalBilled = isDeleted
                      ? 0
                      : roundToNineDecimals(item.periodRows.reduce((sum, row) => sum + row.grandTotal, 0));

                    return (
                      <div
                        key={item.name + itemIdx}
                        className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3 ${
                          isDeleted ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${
                                isDeleted ? 'line-through' : ''
                              }`}
                            >
                              {item.name}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${
                                item.status === 'Terminate'
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : item.status === 'Delete'
                                    ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                              }`}
                            >
                              {item.status}
                            </span>
                            <span className="rounded px-2 py-0.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                              {item.type}
                              {item.type === 'Recurring' ? ` · ${state.billingFrequency}` : ''}
                            </span>
                            {hasTerminateDate && (
                              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                                Terminate {formatDateToDisplay(parseDateString(item.terminateDate))}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                            <span className={mutedText}>
                              Bill{' '}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {itemActiveBills}/{invoiceColumns.length}
                              </span>
                            </span>
                            <span className={mutedText}>
                              Ditagih{' '}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatDisplayNumber(itemTotalBilled)}
                              </span>
                            </span>
                            <span className={mutedText}>
                              Nilai SO{' '}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatDisplayNumber(isDeleted ? 0 : item.grandTotal)}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <div className="min-w-[820px] space-y-1.5">
                            <div className="relative">
                              <div className={`relative h-8 rounded-md overflow-hidden ${idleTrackClass}`}>
                                {invoiceColumns.map((column, periodIdx) => {
                                  const period = column.period;
                                  const row = item.periodRows[periodIdx];
                                  if (!period || !row || isDeleted || row.grandTotal <= 0) return null;
                                  const billedStart = row.activeStartDate ?? period.startDate;
                                  const billedEnd = row.activeEndDate ?? period.endDate;
                                  const billedEndSerial = convertDateToSerialDays(billedEnd);
                                  const isPartial = billedEndSerial < convertDateToSerialDays(period.endDate);
                                  return (
                                    <div
                                      key={column.label}
                                      style={segmentStyle(convertDateToSerialDays(billedStart), billedEndSerial)}
                                      className={`absolute inset-y-0 flex items-center justify-center border-r border-white dark:border-slate-900 text-[10px] font-semibold ${
                                        isPartial ? partialBillClass : fullBillClass
                                      }`}
                                    >
                                      <span className="truncate px-1">
                                        {column.label}
                                        {isPartial ? ` · ${row.activeDays} hari` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                                {invoiceColumns.map(column => {
                                  const period = column.period;
                                  if (!period) return null;
                                  return (
                                    <div
                                      key={`${column.label}-boundary`}
                                      style={{ left: `${toPercent(convertDateToSerialDays(period.startDate))}%` }}
                                      className="absolute inset-y-0 w-px bg-slate-300/70 dark:bg-slate-600/70"
                                    />
                                  );
                                })}
                              </div>

                              {terminateLinePercent !== null && (
                                <div
                                  style={{ left: `${terminateLinePercent}%` }}
                                  className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 z-10"
                                />
                              )}
                            </div>

                            <div className="relative h-4">
                              {invoiceColumns.map(column => {
                                const period = column.period;
                                const row = item.periodRows[invoiceColumns.indexOf(column)];
                                if (!period) return null;
                                const billed = !isDeleted && row && row.grandTotal > 0;
                                return (
                                  <div
                                    key={`${column.label}-caption`}
                                    style={segmentStyle(
                                      convertDateToSerialDays(period.startDate),
                                      convertDateToSerialDays(period.endDate)
                                    )}
                                    className={`absolute inset-y-0 text-center text-[10px] font-mono truncate px-1 ${
                                      billed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'
                                    }`}
                                  >
                                    {billed ? formatDisplayNumber(row.grandTotal) : '0'}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedColumn && (() => {
                const evaluation = evaluateSalesOrderStatusAtNode(selectedInvoiceIndex);
                return (
                  <div className={`${cardClass} p-5 space-y-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Detail evaluasi {selectedColumn.label}
                        </h3>
                        <p className={`text-xs mt-0.5 ${mutedText}`}>
                          Terminate Date dibandingkan dengan Last Invoice ({evaluation.lastInvoiceDateDisplay}) dan
                          Next Invoice ({evaluation.nextInvoiceDateDisplay})
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={mutedText}>Status Sales Order</span>
                        <span
                          className={`rounded px-2.5 py-1 font-semibold ${
                            evaluation.status === 'Terminated'
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          }`}
                        >
                          {evaluation.status}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 font-mono text-xs">
                      {evaluation.reasons.map((reason, idx) => (
                        <div key={idx} className="text-slate-800 dark:text-slate-200">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

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
                        · {item.status}
                        {item.status === 'Terminate' && item.terminateDate
                          ? ` (${item.terminateDate})`
                          : ''}{' '}
                        · {item.type} · {item.unit} · Qty {item.quantity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedItem && selectedPeriodRow && selectedColumn && (() => {
              const isRemainderAbsorbed = Boolean(selectedPeriodRow.isFullContractRemainderAbsorbed);
              const isBackwardUnitProrated =
                isRemainderAbsorbed &&
                selectedPeriodRow.isUnitPriceProrated !== false &&
                selectedItem.quantity > 0;

              const previousRows = selectedItem.periodRows.slice(0, selectedInvoiceIndex);
              const previousBasicDiscountSum = roundToNineDecimals(
                previousRows.reduce((sum, row) => sum + row.totalBasicDiscount, 0)
              );
              const previousTotalAfterBasicSum = roundToNineDecimals(
                previousRows.reduce((sum, row) => sum + row.totalAfterBasicDiscount, 0)
              );
              const previousAdditionalDiscountSum = roundToNineDecimals(
                previousRows.reduce((sum, row) => sum + row.additionalDiscountAmount, 0)
              );
              const previousGrandTotalSum = roundToNineDecimals(
                previousRows.reduce((sum, row) => sum + row.grandTotal, 0)
              );
              const rawNetPerUnitFromRemainder =
                selectedItem.quantity > 0
                  ? selectedPeriodRow.totalAfterBasicDiscount / selectedItem.quantity
                  : 0;

              return (
                <>
                  <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                          <span>
                            {selectedItem.name} di {selectedColumn.label}
                          </span>
                          <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Status: {selectedItem.status}
                            {selectedItem.status === 'Terminate' && selectedItem.terminateDate
                              ? ` (${selectedItem.terminateDate})`
                              : ''}
                          </span>
                          {isRemainderAbsorbed && (
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              Invoice Akhir · Hitung Mundur Sisa Kontrak
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {selectedPeriodRow.activeStartDate && selectedPeriodRow.activeEndDate
                            ? `Periode aktif item: ${formatDateToDisplay(selectedPeriodRow.activeStartDate)} s/d ${formatDateToDisplay(selectedPeriodRow.activeEndDate)} (${selectedPeriodRow.activeDays} hari) · faktor prorata f = ${formatNumberWithNineDecimals(proRataFactor)}`
                            : `Tidak aktif di periode ${formatDateToDisplay(selectedColumn.period!.startDate)} s/d ${formatDateToDisplay(selectedColumn.period!.endDate)} (0 hari) · faktor prorata f = 0`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Item grand total</div>
                        <div className="text-xl font-semibold font-mono text-slate-900 dark:text-slate-100">
                          {formatDisplayNumber(selectedPeriodRow.grandTotal)}
                        </div>
                      </div>
                    </div>

                    {isRemainderAbsorbed && (
                      <div className="rounded-md bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/70 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-indigo-800 dark:text-indigo-300">
                          Penyesuaian Invoice Akhir (Hitung Mundur):
                        </span>{' '}
                        {isBackwardUnitProrated
                          ? 'Total pada invoice terakhir mengambil sisa nilai kontrak SO (SO − akumulasi invoice sebelumnya), lalu Net Price/Unit, Basic Discount/Unit, dan Selling Price/Unit dihitung mundur dari sisa Total After Basic tersebut agar konsisten.'
                          : 'Total pada invoice terakhir mengambil sisa nilai kontrak SO (SO − akumulasi invoice sebelumnya) agar selisih = 0, sementara harga per unit tetap mengikuti harga SO (siklus non-Monthly).'}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepCard
                      stepNumber={1}
                      title="Price per unit"
                      description={
                        isBackwardUnitProrated
                          ? 'Hitung mundur dari sisa Total after basic (Step 5) agar konsisten dengan sisa kontrak.'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Frekuensi selain Monthly (tanpa Terminate di tengah periode): harga satuan tetap sama dengan SO.'
                            : `Harga satuan dikalikan faktor prorata f (${formatNumberWithNineDecimals(proRataFactor)}).`
                      }
                      formulaRule={
                        isBackwardUnitProrated
                          ? selectedItem.basicDiscountType === 'Percentage'
                            ? '(Sisa Total after basic ÷ Qty) ÷ (1 − Basic Disc %)'
                            : '(Sisa Total after basic + Sisa Total basic disc) ÷ Qty'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Tetap = Price SO'
                            : 'Price × f'
                      }
                      calculationLines={[
                        isBackwardUnitProrated
                          ? selectedItem.basicDiscountType === 'Percentage'
                            ? `(${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)} ÷ ${selectedItem.quantity}) ÷ (1 − ${selectedItem.basicDiscountValue}%) = ${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)}`
                            : `(${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)} + ${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}) ÷ ${selectedItem.quantity} = ${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)}`
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? `${formatDisplayNumber(selectedItem.price)} = ${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)}`
                            : `${formatDisplayNumber(selectedItem.price)} × ${formatNumberWithNineDecimals(proRataFactor)} = ${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)}`
                      ]}
                      resultValue={formatDisplayNumber(selectedPeriodRow.unitPrice || 0)}
                    />
                    <StepCard
                      stepNumber={2}
                      title="Basic discount per unit"
                      description={
                        isBackwardUnitProrated
                          ? 'Hitung mundur dari selisih Price per unit dan Net price per unit (atau sisa Total basic disc ÷ Qty).'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Frekuensi selain Monthly (tanpa Terminate di tengah periode): diskon dasar satuan tetap sama dengan SO.'
                            : `Diskon dasar per unit (${
                                selectedItem.basicDiscountType === 'Percentage'
                                  ? `${selectedItem.basicDiscountValue}%`
                                  : `nominal ${selectedItem.basicDiscountValue}`
                              }).`
                      }
                      formulaRule={
                        isBackwardUnitProrated
                          ? selectedItem.basicDiscountType === 'Percentage'
                            ? 'Price per unit − Net price per unit'
                            : 'Sisa Total basic discount ÷ Qty'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Tetap = Basic discount / unit SO'
                            : selectedItem.basicDiscountType === 'Percentage'
                              ? 'Price per unit × %'
                              : 'Basic discount × f'
                      }
                      calculationLines={[
                        isBackwardUnitProrated
                          ? selectedItem.basicDiscountType === 'Percentage'
                            ? `${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)} − ${formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)} = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}`
                            : `${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)} ÷ ${selectedItem.quantity} = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}`
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? `${formatDisplayNumber(selectedItem.basicDiscountPerUnit)} = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}`
                            : selectedItem.basicDiscountType === 'Percentage'
                              ? `${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)} × ${selectedItem.basicDiscountValue}% = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}`
                              : `${formatDisplayNumber(selectedItem.basicDiscountPerUnit)} × ${formatNumberWithNineDecimals(proRataFactor)} = ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}`
                      ]}
                      resultValue={formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)}
                    />
                    <StepCard
                      stepNumber={3}
                      title="Net price per unit"
                      description={
                        isBackwardUnitProrated
                          ? 'Hitung mundur: sisa Total after basic dibagi Qty.'
                          : 'Harga satuan dikurangi diskon dasar satuan.'
                      }
                      formulaRule={
                        isBackwardUnitProrated
                          ? 'Sisa Total after basic ÷ Qty'
                          : 'Price per unit − Basic discount per unit'
                      }
                      calculationLines={[
                        isBackwardUnitProrated
                          ? `${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)} ÷ ${selectedItem.quantity} = ${rawNetPerUnitFromRemainder.toFixed(6)} → ${formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)}`
                          : `${formatDisplayNumber(selectedPeriodRow.unitPrice || 0)} − ${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)} = ${formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)}`
                      ]}
                      resultValue={formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)}
                    />
                    <StepCard
                      stepNumber={4}
                      title="Total basic discount"
                      description={
                        isRemainderAbsorbed
                          ? 'Menyerap sisa Total basic discount SO setelah dikurangi akumulasi invoice sebelumnya.'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? `Diskon dasar satuan dikalikan Qty (${selectedItem.quantity}) dan faktor bulan periode f (${formatNumberWithNineDecimals(proRataFactor)}).`
                            : `Diskon dasar per unit dikalikan Qty (${selectedItem.quantity}).`
                      }
                      formulaRule={
                        isRemainderAbsorbed
                          ? 'SO total basic disc − Akumulasi invoice sebelumnya'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Basic discount per unit × Qty × f'
                            : 'Basic discount per unit × Qty'
                      }
                      calculationLines={[
                        isRemainderAbsorbed
                          ? `${formatDisplayNumber(selectedItem.totalBasicDiscount)} − ${formatDisplayNumber(previousBasicDiscountSum)} = ${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}`
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? `${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)} × ${selectedItem.quantity} × ${formatNumberWithNineDecimals(proRataFactor)} = ${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}`
                            : `${formatDisplayNumber(selectedPeriodRow.basicDiscountPerUnit || 0)} × ${selectedItem.quantity} = ${formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}`
                      ]}
                      resultValue={formatDisplayNumber(selectedPeriodRow.totalBasicDiscount)}
                    />
                    <StepCard
                      stepNumber={5}
                      title="Total after basic"
                      description={
                        isRemainderAbsorbed
                          ? 'Menyerap sisa Total after basic SO agar akumulasi seluruh invoice tepat sama dengan SO.'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? `Net price per unit dikalikan Qty (${selectedItem.quantity}) dan faktor bulan periode f (${formatNumberWithNineDecimals(proRataFactor)}), lalu dibulatkan.`
                            : 'Net price per unit dikalikan Qty, lalu dibulatkan ke bilangan bulat.'
                      }
                      formulaRule={
                        isRemainderAbsorbed
                          ? 'SO total after basic − Akumulasi invoice sebelumnya'
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? 'Round(Net price per unit × Qty × f)'
                            : 'Round(Net price per unit × Qty)'
                      }
                      calculationLines={
                        isRemainderAbsorbed
                          ? [
                              `${formatDisplayNumber(selectedItem.totalAfterBasicDiscount)} − ${formatDisplayNumber(previousTotalAfterBasicSum)} = ${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}`
                            ]
                          : selectedPeriodRow.isUnitPriceProrated === false
                            ? [
                                `${formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)} × ${selectedItem.quantity} × ${formatNumberWithNineDecimals(proRataFactor)} = ${(Number(selectedPeriodRow.netPricePerUnit || 0) * selectedItem.quantity * proRataFactor).toFixed(2)}`,
                                `Round(${(Number(selectedPeriodRow.netPricePerUnit || 0) * selectedItem.quantity * proRataFactor).toFixed(2)}) = ${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}`
                              ]
                            : [
                                `${formatDisplayNumber(selectedPeriodRow.netPricePerUnit || 0)} × ${selectedItem.quantity} = ${(Number(selectedPeriodRow.netPricePerUnit || 0) * selectedItem.quantity).toFixed(2)}`,
                                `Round(${(Number(selectedPeriodRow.netPricePerUnit || 0) * selectedItem.quantity).toFixed(2)}) = ${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}`
                              ]
                      }
                      resultValue={formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)}
                      isHighlighted
                    />
                    <StepCard
                      stepNumber={6}
                      title="Additional discount"
                      description={
                        isRemainderAbsorbed
                          ? 'Menyerap sisa Additional discount SO setelah dikurangi akumulasi invoice sebelumnya.'
                          : `Diskon tambahan kontrak (${formatDisplayNumber(selectedItem.additionalDiscountAmount)}) dibagi rata sesuai durasi dan faktor prorata.`
                      }
                      formulaRule={
                        isRemainderAbsorbed
                          ? 'SO additional discount − Akumulasi invoice sebelumnya'
                          : 'Round(SO additional discount × f ÷ durasi)'
                      }
                      calculationLines={[
                        isRemainderAbsorbed
                          ? `${formatDisplayNumber(selectedItem.additionalDiscountAmount)} − ${formatDisplayNumber(previousAdditionalDiscountSum)} = ${formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)}`
                          : `${formatDisplayNumber(selectedItem.additionalDiscountAmount)} × ${formatNumberWithNineDecimals(proRataFactor)} ÷ ${selectedItem.duration} = ${formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)}`
                      ]}
                      resultValue={formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)}
                    />
                  </div>

                  <StepCard
                    stepNumber={7}
                    title={`Item grand total di ${selectedColumn.label}`}
                    description={
                      isRemainderAbsorbed
                        ? 'Menyerap sisa Grand total SO setelah dikurangi akumulasi invoice sebelumnya (selisih = 0).'
                        : `Nilai bersih produk ini yang masuk ke pre-tax ${selectedColumn.label}.`
                    }
                    formulaRule={
                      isRemainderAbsorbed
                        ? 'SO grand total − Akumulasi invoice sebelumnya'
                        : 'Total after basic − Additional discount'
                    }
                    calculationLines={[
                      isRemainderAbsorbed
                        ? `${formatDisplayNumber(selectedItem.grandTotal)} − ${formatDisplayNumber(previousGrandTotalSum)} = ${formatDisplayNumber(selectedPeriodRow.grandTotal)}`
                        : `${formatDisplayNumber(selectedPeriodRow.totalAfterBasicDiscount)} − ${formatDisplayNumber(selectedPeriodRow.additionalDiscountAmount)} = ${formatDisplayNumber(selectedPeriodRow.grandTotal)}`
                    ]}
                    resultValue={formatDisplayNumber(selectedPeriodRow.grandTotal)}
                    isHighlighted
                  />
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'so-base' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Nilai dasar kontrak (SO)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Nilai kontrak penuh tiap produk (tetap mengikuti durasi kontrak awal meskipun produk berstatus Terminate).
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.type} · Status: {item.status}
                        {item.status === 'Terminate' && item.terminateDate
                          ? ` (${item.terminateDate})`
                          : ''}
                      </div>
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
                      ['Durasi SO', `${item.duration} ${item.type === 'DR (Daily)' ? 'hari' : 'bulan'}`],
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
