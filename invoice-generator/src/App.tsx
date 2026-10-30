import { Fragment, useState, useMemo, useEffect } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiInfo,
  FiAlertCircle,
  FiCheckCircle,
  FiActivity,
  FiChevronDown,
  FiChevronRight,
  FiSun,
  FiMoon
} from 'react-icons/fi';

import type {
  ProductItem,
  InvoiceCalculatorState,
  ProductType,
  DiscountType,
  BillingFrequency,
  CalculatedProductItem,
  UnitType,
  ThemeMode
} from './types';
import {
  calculateInvoiceSchedule,
  formatDisplayNumber,
  formatNumberWithTwoDecimals,
  formatNumberWithNineDecimals,
  buildInvoiceSummaryTableRows,
  buildProductBreakdownTableRows,
  collectInvoiceReconciliationWarnings,
  createNewEmptyProductItem
} from './utils/calculator';
import { DateInput } from './components/DateInput';
import { FormInput } from './components/FormInput';
import { CalculationTrace } from './components/CalculationTrace';

const PRODUCT_TYPES: ProductType[] = ['One time', 'Recurring', 'DR (Daily)'];
const UNIT_TYPES: UnitType[] = ['Unit', 'GB'];
const DISCOUNT_TYPES: DiscountType[] = ['Amount', 'Percentage'];
const BILLING_FREQUENCIES: BillingFrequency[] = ['Monthly', 'Quarterly', 'Semester', 'Yearly'];

const INITIAL_PRODUCT_ITEMS: ProductItem[] = [
  {
    id: '1',
    name: 'test 1',
    type: 'One time',
    unit: 'Unit',
    price: '123125',
    basicDiscountType: 'Percentage',
    basicDiscountValue: '23.13',
    quantity: '2',
    dailyRateStartDate: '',
    dailyRateEndDate: '',
    additionalDiscountType: 'Percentage',
    additionalDiscountValue: '12.51',
    salesOrderExpectedTotal: ''
  },
  {
    id: '2',
    name: 'test gb one',
    type: 'One time',
    unit: 'GB',
    price: '1259.49',
    basicDiscountType: 'Percentage',
    basicDiscountValue: '11.57',
    quantity: '157',
    dailyRateStartDate: '',
    dailyRateEndDate: '',
    additionalDiscountType: 'Percentage',
    additionalDiscountValue: '10.11',
    salesOrderExpectedTotal: ''
  },
  {
    id: '3',
    name: 'test 2',
    type: 'Recurring',
    unit: 'Unit',
    price: '100557',
    basicDiscountType: 'Amount',
    basicDiscountValue: '1107',
    quantity: '2',
    dailyRateStartDate: '',
    dailyRateEndDate: '',
    additionalDiscountType: 'Percentage',
    additionalDiscountValue: '15.13',
    salesOrderExpectedTotal: ''
  },
  {
    id: '4',
    name: 'test gb recu',
    type: 'Recurring',
    unit: 'GB',
    price: '1827.77',
    basicDiscountType: 'Amount',
    basicDiscountValue: '123.57',
    quantity: '1087',
    dailyRateStartDate: '',
    dailyRateEndDate: '',
    additionalDiscountType: 'Percentage',
    additionalDiscountValue: '12.12',
    salesOrderExpectedTotal: ''
  }
];

function getInitialThemeMode(): ThemeMode {
  if (typeof window !== 'undefined') {
    const savedTheme = window.localStorage.getItem('invoice-theme-mode');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
  }
  return 'light';
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialThemeMode);
  const [currentPage, setCurrentPage] = useState<'generator' | 'trace'>('generator');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<InvoiceCalculatorState>({
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    billingFrequency: 'Quarterly',
    cycleDay: '20',
    taxRatePercent: '11',
    deductedTaxRatePercent: '0',
    targetCurrency: '',
    exchangeRate: '1',
    items: INITIAL_PRODUCT_ITEMS
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('invoice-theme-mode', theme);
  }, [theme]);

  function toggleThemeMode() {
    setTheme(previousTheme => (previousTheme === 'light' ? 'dark' : 'light'));
  }

  function toggleExpandableRow(rowId: string) {
    setExpandedRows(previous => ({ ...previous, [rowId]: !previous[rowId] }));
  }

  function updateGlobalParameter(field: keyof InvoiceCalculatorState, value: string) {
    setState(previous => ({ ...previous, [field]: value }));
  }

  function updateProductItemField(index: number, field: keyof ProductItem, value: string) {
    setState(previous => {
      const updatedItems = [...previous.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...previous, items: updatedItems };
    });
  }

  function handleAddProductItem() {
    setState(previous => ({
      ...previous,
      items: [...previous.items, createNewEmptyProductItem()]
    }));
  }

  function handleRemoveProductItem(indexToRemove: number) {
    setState(previous => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== indexToRemove)
    }));
  }

  const calculation = useMemo(() => calculateInvoiceSchedule(state), [state]);

  const targetCurrencySuffix = state.targetCurrency ? ` (${state.targetCurrency})` : '';
  const exchangeRateMultiplier = Number(state.exchangeRate) || 1;

  const invoiceSummaryRows = useMemo(
    () =>
      buildInvoiceSummaryTableRows(
        calculation,
        targetCurrencySuffix,
        exchangeRateMultiplier
      ),
    [calculation, targetCurrencySuffix, exchangeRateMultiplier]
  );

  const warnings = useMemo(
    () => collectInvoiceReconciliationWarnings(calculation, invoiceSummaryRows),
    [calculation, invoiceSummaryRows]
  );

  const inputClass =
    'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 dark:focus:ring-slate-600 focus:border-gray-300 dark:focus:border-slate-600 outline-none transition text-gray-900 dark:text-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full placeholder-gray-300 dark:placeholder-slate-500 hover:border-gray-300 dark:hover:border-slate-600';
  const selectClass =
    'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 dark:focus:ring-slate-600 focus:border-gray-300 dark:focus:border-slate-600 outline-none transition text-gray-900 dark:text-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full hover:border-gray-300 dark:hover:border-slate-600 cursor-pointer';

  if (currentPage === 'trace') {
    return (
      <CalculationTrace
        state={state}
        calculation={calculation}
        theme={theme}
        onToggleTheme={toggleThemeMode}
        onBack={() => setCurrentPage('generator')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 p-4 md:p-8 font-sans text-gray-900 dark:text-slate-100 selection:bg-gray-200 dark:selection:bg-slate-800 transition-colors">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <header className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-6 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-slate-100 mb-2">
              Invoice Calculator
            </h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm flex items-center justify-center md:justify-start gap-1.5 font-normal">
              <FiInfo className="shrink-0" />
              <span>Generate schedules from Sales Orders for One-time, Recurring, and DR products.</span>
            </p>
          </div>
          <div className="flex items-center gap-3 self-center md:self-auto">
            <button
              type="button"
              onClick={toggleThemeMode}
              aria-label="Toggle Light or Dark Mode"
              className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-medium text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <FiSun size={16} className="text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <FiMoon size={16} className="text-slate-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <button
              onClick={() => setCurrentPage('trace')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-800 shadow-xs transition-all cursor-pointer"
            >
              <FiActivity size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>Visual Trace Perhitungan</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 text-[10px] font-bold">
                Baru
              </span>
            </button>
          </div>
        </header>

        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors">
          <h2 className="text-lg font-medium mb-6 text-gray-800 dark:text-slate-100 flex items-center gap-3">
            <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200 dark:border-slate-700">
              1
            </span>
            Global Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            <FormInput label="Start Subscription">
              <DateInput
                className={inputClass}
                value={state.startDate}
                onChange={event => updateGlobalParameter('startDate', event.target.value)}
              />
            </FormInput>
            <FormInput label="End Subscription">
              <DateInput
                className={inputClass}
                value={state.endDate}
                onChange={event => updateGlobalParameter('endDate', event.target.value)}
              />
            </FormInput>
            <FormInput label="Billing Period">
              <select
                className={selectClass}
                value={state.billingFrequency}
                onChange={event =>
                  updateGlobalParameter('billingFrequency', event.target.value as BillingFrequency)
                }
              >
                {BILLING_FREQUENCIES.map(frequency => (
                  <option key={frequency} value={frequency}>
                    {frequency}
                  </option>
                ))}
              </select>
            </FormInput>
            <FormInput label="Invoice Cycle Day" note="Blank = follows start date">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.cycleDay}
                onChange={event => updateGlobalParameter('cycleDay', event.target.value)}
                placeholder="e.g. 20"
              />
            </FormInput>
            <FormInput label="Taxes & Charges (%)">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.taxRatePercent}
                onChange={event => updateGlobalParameter('taxRatePercent', event.target.value)}
              />
            </FormInput>
            <FormInput label="Deducted Taxes (%)">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.deductedTaxRatePercent}
                onChange={event => updateGlobalParameter('deductedTaxRatePercent', event.target.value)}
              />
            </FormInput>
            <FormInput label="Target Currency">
              <input
                type="text"
                className={inputClass}
                value={state.targetCurrency}
                onChange={event => updateGlobalParameter('targetCurrency', event.target.value)}
                placeholder="e.g. IDR"
              />
            </FormInput>
            <FormInput label="Exchange Rate">
              <input
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={state.exchangeRate}
                onChange={event => updateGlobalParameter('exchangeRate', event.target.value)}
              />
            </FormInput>
          </div>

          <div className="mt-8 bg-gray-50 dark:bg-slate-800/70 border border-gray-100 dark:border-slate-800 rounded-xl px-4 py-3 inline-flex items-center text-sm text-gray-600 dark:text-slate-300 font-medium">
            {`Recurring duration: ${formatDisplayNumber(calculation.recurringDurationMonths)} months • ${calculation.monthsPerInvoice} month(s) per invoice • ${calculation.billingPeriods.length} invoice(s)`}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors">
          <h2 className="text-lg font-medium mb-6 text-gray-800 dark:text-slate-100 flex items-center gap-3">
            <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200 dark:border-slate-700">
              2
            </span>
            Products List
          </h2>

          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Total Basic Discount
              </span>
              <div className="text-xl font-semibold font-mono text-gray-900 dark:text-slate-100 mt-1">
                {formatDisplayNumber(calculation.totalBasicDiscount)} {state.targetCurrency}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Total Additional Discount
              </span>
              <div className="text-xl font-semibold font-mono text-gray-900 dark:text-slate-100 mt-1">
                {formatDisplayNumber(calculation.salesOrderSummary.totalAdditionalDiscount)}{' '}
                {state.targetCurrency}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Total Recurring Net (SO)
              </span>
              <div className="text-xl font-semibold font-mono text-gray-900 dark:text-slate-100 mt-1">
                {formatDisplayNumber(calculation.salesOrderSummary.recurringTotal)} {state.targetCurrency}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 dark:border-slate-800 rounded-xl mb-6 shadow-sm">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-800">
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
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {state.items.map((item, itemIndex) => {
                  const calculatedItem = calculation.allCalculatedItems[itemIndex];

                  return (
                    <tr
                      key={item.id}
                      className="bg-white dark:bg-slate-900 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="px-3 py-3">
                        <input
                          className={inputClass}
                          value={item.name}
                          onChange={event =>
                            updateProductItemField(itemIndex, 'name', event.target.value)
                          }
                          placeholder="Name"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={item.type}
                          onChange={event =>
                            updateProductItemField(
                              itemIndex,
                              'type',
                              event.target.value as ProductType
                            )
                          }
                        >
                          {PRODUCT_TYPES.map(productType => (
                            <option key={productType} value={productType}>
                              {productType}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={item.unit || 'Unit'}
                          onChange={event =>
                            updateProductItemField(itemIndex, 'unit', event.target.value as UnitType)
                          }
                        >
                          {UNIT_TYPES.map(unitType => (
                            <option key={unitType} value={unitType}>
                              {unitType}
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
                          onChange={event =>
                            updateProductItemField(itemIndex, 'price', event.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select
                            className={selectClass + ' !px-2 w-[70px]'}
                            value={item.basicDiscountType}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'basicDiscountType',
                                event.target.value as DiscountType
                              )
                            }
                          >
                            {DISCOUNT_TYPES.map(discountType => (
                              <option key={discountType} value={discountType}>
                                {discountType === 'Amount' ? '$' : '%'}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass + ' w-[90px]'}
                            value={item.basicDiscountValue}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'basicDiscountValue',
                                event.target.value
                              )
                            }
                            placeholder={item.basicDiscountType === 'Percentage' ? '%' : 'Amt'}
                          />
                        </div>
                        {calculatedItem?.isUsed && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 font-mono">
                            Total: {formatDisplayNumber(calculatedItem.totalBasicDiscount)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          value={item.quantity}
                          onChange={event =>
                            updateProductItemField(itemIndex, 'quantity', event.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <DateInput
                            className={inputClass + ' !py-1 text-[13px]'}
                            value={item.dailyRateStartDate}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'dailyRateStartDate',
                                event.target.value
                              )
                            }
                            style={{ width: '130px' }}
                          />
                          <DateInput
                            className={inputClass + ' !py-1 text-[13px]'}
                            value={item.dailyRateEndDate}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'dailyRateEndDate',
                                event.target.value
                              )
                            }
                            style={{ width: '130px' }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <select
                            className={selectClass + ' !px-2 w-[70px]'}
                            value={item.additionalDiscountType}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'additionalDiscountType',
                                event.target.value as DiscountType
                              )
                            }
                          >
                            {DISCOUNT_TYPES.map(discountType => (
                              <option key={discountType} value={discountType}>
                                {discountType === 'Amount' ? '$' : '%'}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass + ' w-[90px]'}
                            value={item.additionalDiscountValue}
                            onChange={event =>
                              updateProductItemField(
                                itemIndex,
                                'additionalDiscountValue',
                                event.target.value
                              )
                            }
                            placeholder={item.additionalDiscountType === 'Percentage' ? '%' : 'Amt'}
                          />
                        </div>
                        {calculatedItem?.isUsed && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 font-mono">
                            Total: {formatDisplayNumber(calculatedItem.additionalDiscountAmount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-800 dark:text-slate-200">
                        {calculatedItem?.isUsed ? formatDisplayNumber(calculatedItem.grandTotal) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleRemoveProductItem(itemIndex)}
                          className="text-gray-400 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
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
            onClick={handleAddProductItem}
            className="inline-flex items-center justify-center gap-2 bg-black dark:bg-indigo-600 hover:bg-gray-800 dark:hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-sm transition font-medium text-sm w-full sm:w-auto cursor-pointer"
          >
            <FiPlus size={16} /> Add Product
          </button>

          <p className="mt-6 text-xs text-gray-400 dark:text-slate-500 flex gap-2 font-normal">
            <FiInfo className="shrink-0 mt-0.5" />
            <span>
              Recurring duration is automatic from start/end. One time = billed in INV 1. DR = price × qty × days. Unit GB = unrounded (2 decimal places), Unit non-GB = rounded to integer. Rows without a price are ignored.
            </span>
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-10 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-medium text-gray-800 dark:text-slate-100 flex items-center gap-3">
              <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-200 dark:border-slate-700">
                3
              </span>
              Invoices Breakdown
            </h2>
            <button
              onClick={() => setCurrentPage('trace')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
            >
              <FiActivity size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>Lihat Visual Trace Rumus</span>
            </button>
          </div>

          {warnings.length > 0 ? (
            <div className="mb-8 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3 text-gray-800 dark:text-slate-200">
                <FiAlertCircle className="mt-0.5 shrink-0 text-amber-500" size={18} />
                <div className="flex flex-col gap-1.5">
                  {warnings.map((warningText, index) => (
                    <span key={index} className="text-sm">
                      {warningText}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-800 rounded-xl p-4 text-gray-600 dark:text-slate-300 flex items-center gap-2 text-sm font-medium">
              <FiCheckCircle size={18} className="text-emerald-500" /> All invoices match the Sales Order amounts perfectly.
            </div>
          )}

          {calculation.invoiceColumns.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 dark:border-slate-800 rounded-xl mb-8 shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-4 sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 w-48 font-medium">
                      Description
                    </th>
                    <th className="px-5 py-4 text-right font-medium">SO Value</th>
                    <th className="px-5 py-4 text-right font-medium">Invoice Total</th>
                    <th className="px-5 py-4 text-right font-medium">Difference</th>
                    {calculation.invoiceColumns.map(column => (
                      <th
                        key={column.label}
                        className="px-5 py-4 text-right font-medium text-gray-900 dark:text-slate-100"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {invoiceSummaryRows.map((row, rowIndex) => {
                    const isProRataFactorRow = String(row.values[0]).includes('Pro-rata factor');
                    const rowId = row.id;
                    const isExpandable = Boolean(rowId && row.rawValues);
                    const isExpanded = Boolean(rowId && expandedRows[rowId]);

                    return (
                      <Fragment key={rowIndex}>
                        <tr
                          className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                            row.customClass || ''
                          }`}
                        >
                          {row.values.map((cellValue, columnIndex) => (
                            <td
                              key={columnIndex}
                              className={`px-5 py-3.5 ${
                                columnIndex === 0
                                  ? 'sticky left-0 bg-white dark:bg-slate-900 z-10 font-medium text-gray-700 dark:text-slate-200'
                                  : 'text-right font-mono text-gray-600 dark:text-slate-300'
                              }`}
                            >
                              {columnIndex === 0 && isExpandable && rowId ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandableRow(rowId)}
                                  aria-expanded={isExpanded}
                                  title="Tampilkan nilai sebelum pembulatan"
                                  className="inline-flex items-center gap-1.5 cursor-pointer text-left hover:text-gray-900 dark:hover:text-white"
                                >
                                  {isExpanded ? (
                                    <FiChevronDown size={14} />
                                  ) : (
                                    <FiChevronRight size={14} />
                                  )}
                                  <span>{formatDisplayNumber(cellValue)}</span>
                                </button>
                              ) : isProRataFactorRow && typeof cellValue === 'number' ? (
                                formatNumberWithNineDecimals(cellValue)
                              ) : (
                                formatDisplayNumber(cellValue)
                              )}
                            </td>
                          ))}
                        </tr>
                        {isExpanded && row.rawValues && (
                          <tr className="bg-gray-50 dark:bg-slate-800/50 text-xs italic text-gray-500 dark:text-slate-400">
                            {row.rawValues.map((rawValue, columnIndex) => (
                              <td
                                key={columnIndex}
                                className={`px-5 py-2.5 ${
                                  columnIndex === 0
                                    ? 'sticky left-0 bg-gray-50 dark:bg-slate-800 z-10 pl-12 font-medium not-italic'
                                    : 'text-right font-mono'
                                }`}
                              >
                                {columnIndex === 0
                                  ? rawValue
                                  : formatNumberWithTwoDecimals(rawValue)}
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
            <div className="text-center py-12 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 font-medium text-sm">
              Enter valid dates and at least one product with a price to see the invoice breakdown.
            </div>
          )}

          {calculation.invoiceColumns.length > 0 && calculation.activeCalculatedItems.length > 0 && (
            <div className="mt-10 space-y-4">
              <h3 className="text-base font-medium text-gray-800 dark:text-slate-100 mb-5">
                Product Level Breakdown
              </h3>

              {calculation.activeCalculatedItems.map(
                (item: CalculatedProductItem, productIndex: number) => {
                  const productTableRows = buildProductBreakdownTableRows(
                    item,
                    calculation,
                    targetCurrencySuffix,
                    exchangeRateMultiplier
                  );

                  return (
                    <details
                      key={productIndex}
                      className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm"
                    >
                      <summary className="px-5 py-4 cursor-pointer font-medium text-gray-800 dark:text-slate-100 bg-gray-50 dark:bg-slate-800/70 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between">
                        <span className="flex items-center gap-3 flex-wrap">
                          <span>{item.name || '(No name)'}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600"></span>
                          <span className="text-sm font-normal text-gray-500 dark:text-slate-400">
                            {item.type}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600"></span>
                          <span className="text-sm font-normal text-gray-500 dark:text-slate-400">
                            Unit: {item.unit}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600"></span>
                          <span className="text-sm font-normal text-gray-500 dark:text-slate-400">
                            Qty: {item.quantity}
                          </span>
                        </span>
                        <span className="text-gray-400 dark:text-slate-500 transition-transform group-open:rotate-180">
                          <FiPlus />
                        </span>
                      </summary>
                      <div className="p-0 overflow-x-auto border-t border-gray-200 dark:border-slate-800">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                          <thead className="text-xs text-gray-400 dark:text-slate-400 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                            <tr>
                              <th className="px-5 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10 font-medium">
                                Item Metric
                              </th>
                              <th className="px-5 py-3 text-right font-medium">SO Value</th>
                              <th className="px-5 py-3 text-right font-medium">Inv Total</th>
                              <th className="px-5 py-3 text-right font-medium">Difference</th>
                              {calculation.invoiceColumns.map(column => (
                                <th key={column.label} className="px-5 py-3 text-right font-medium">
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {productTableRows.map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                                  row.customClass || ''
                                }`}
                              >
                                {row.values.map((cellValue, columnIndex) => (
                                  <td
                                    key={columnIndex}
                                    className={`px-5 py-2.5 ${
                                      columnIndex === 0
                                        ? 'sticky left-0 bg-white dark:bg-slate-900 z-10 font-normal text-gray-600 dark:text-slate-300'
                                        : 'text-right font-mono text-gray-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {formatDisplayNumber(cellValue)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
