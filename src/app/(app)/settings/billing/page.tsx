'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';
import { CreditCard, Download, CheckCircle2 } from 'lucide-react';

const INVOICES = [
  { id: '1', date: 'Apr 1, 2026', amount: '$79.00', status: 'Paid' },
  { id: '2', date: 'Mar 1, 2026', amount: '$79.00', status: 'Paid' },
  { id: '3', date: 'Feb 1, 2026', amount: '$79.00', status: 'Paid' },
];

export default function BillingSettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.billing.badge')}
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            {t('settings.billing.title')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {t('settings.billing.description')}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Current Plan */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              {t('settings.billing.currentPlan')}
            </p>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              {t('common.active')}
            </span>
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-on-surface">Pro Plan</p>
                <p className="text-sm text-on-surface-variant">$79/mo · Billed monthly</p>
              </div>
            </div>
            <button className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container">
              {t('settings.billing.changePlan')}
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.billing.paymentMethod')}
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {t('settings.billing.cardEndingIn').replace('{last4}', '4242')}
                </p>
                <p className="text-xs text-on-surface-variant">Expires 12/28</p>
              </div>
            </div>
            <button className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container">
              {t('settings.billing.updatePayment')}
            </button>
          </div>
        </div>

        {/* Billing History */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.billing.history')}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Date</th>
                  <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Amount</th>
                  <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Status</th>
                  <th className="pb-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {INVOICES.map((invoice) => (
                  <tr key={invoice.id} className="group">
                    <td className="py-4 text-sm text-on-surface">{invoice.date}</td>
                    <td className="py-4 text-sm text-on-surface">{invoice.amount}</td>
                    <td className="py-4">
                      <span className="inline-flex rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-success">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <Download className="h-3.5 w-3.5" />
                        {t('common.download') || 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
