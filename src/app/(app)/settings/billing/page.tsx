'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';
import { CreditCard, Download, CheckCircle2, MessageSquare } from 'lucide-react';
import { useAppContext } from '@/components/app/AppContext';

const INVOICES = [
  { id: '1', date: 'Apr 1, 2026', amount: '$0.00', status: 'Paid' },
];

const PLAN_FEATURES = {
  free: [
    '50 messages per month',
    '1 active agent',
    'Community support',
  ],
  starter: [
    '500 messages per month',
    'Up to 3 agents',
    'Full integrations',
    'Priority support',
  ],
  premium: [
    '4000 messages per month',
    'Unlimited agents',
    'Full integrations',
    'Dedicated support',
  ],
};

const PLAN_PRICES = {
  free: '$0',
  starter: '$30',
  premium: '$110',
};

export default function BillingSettingsPage() {
  const { t, language } = useLanguage();
  const { workspace, subscription } = useAppContext();

  const currentPlan = subscription?.plan_tier || 'free';
  const usagePercent = subscription 
    ? Math.min(Math.round((subscription.messages_used / subscription.messages_limit) * 100), 100)
    : 0;

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
        {/* Usage Overview */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              {t('settings.billing.messages')}
            </p>
            {subscription && (
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
                {t('settings.billing.messagesReset', { 
                  date: new Date(subscription.billing_cycle_end).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US') 
                })}
              </p>
            )}
          </div>
          
          <div className="mt-6">
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-center gap-2 text-on-surface">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">
                  {t('settings.billing.messagesUsed', {
                    used: subscription?.messages_used ?? 0,
                    limit: subscription?.messages_limit ?? 50
                  })}
                </span>
              </div>
              <span className="text-sm font-medium text-on-surface-variant">{usagePercent}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container">
              <div 
                className={`h-full transition-all duration-500 ${usagePercent > 90 ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>

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
                <p className="text-xl font-bold text-on-surface">
                  {t(`settings.billing.plans.${currentPlan}`)} {t('settings.billing.title').split(' ')[1]}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {PLAN_PRICES[currentPlan as keyof typeof PLAN_PRICES]}/mo · Billed monthly
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container">
                {t('settings.billing.changePlan')}
              </button>
            </div>
          </div>
        </div>

        {/* Plan Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['free', 'starter', 'premium'] as const).map((plan) => (
            <div 
              key={plan}
              className={`rounded-[1.7rem] border p-6 transition-all ${
                currentPlan === plan 
                  ? 'border-primary bg-primary/5' 
                  : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50'
              }`}
            >
              <h3 className="text-lg font-bold text-on-surface">{t(`settings.billing.plans.${plan}`)}</h3>
              <p className="mt-1 text-sm text-on-surface-variant leading-tight">{t(`settings.billing.plans.${plan}Desc`)}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-on-surface">{PLAN_PRICES[plan]}</span>
                <span className="text-xs text-on-surface-variant">/mo</span>
              </div>
              
              <ul className="mt-6 space-y-3">
                {PLAN_FEATURES[plan].map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                disabled={currentPlan === plan}
                className={`mt-8 w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                  currentPlan === plan
                    ? 'bg-surface-container text-on-surface-variant cursor-default'
                    : 'bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20'
                }`}
              >
                {currentPlan === plan ? t('common.active') : t('settings.billing.changePlan')}
              </button>
            </div>
          ))}
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
                <p className="text-sm font-bold text-on-surface uppercase tracking-widest text-[10px]">
                  {currentPlan === 'free' ? 'No payment method' : t('settings.billing.cardEndingIn', { last4: '4242' })}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {currentPlan === 'free' ? 'Upgrade to a paid plan to add a card' : 'Expires 12/28'}
                </p>
              </div>
            </div>
            {currentPlan !== 'free' && (
              <button className="rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container">
                {t('settings.billing.updatePayment')}
              </button>
            )}
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
                        {t('common.download')}
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
