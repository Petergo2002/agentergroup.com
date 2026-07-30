'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { Coins, CreditCard, Download, CheckCircle2, MessageSquare, ExternalLink, Loader2, LockKeyhole } from 'lucide-react';
import { useAppContext } from '@/components/app/AppContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { EXTRA_MESSAGE_CREDIT_PACK_AMOUNT } from '@/lib/billing-credits';

// ─── Static plan data ─────────────────────────────────────────────────────────

const PLAN_FEATURES = {
  free:    ['1 workspace', '1 widget', '50 messages per month', '1 active agent', '0 team members', '10 MB Knowledge Base storage', 'Community support'],
  starter: ['1 workspace', 'Up to 3 widgets', '500 messages per month', 'Up to 3 agents', 'Up to 2 team members', '25 MB Knowledge Base storage', 'Full integrations', 'Priority support'],
  premium: ['Up to 5 workspaces', 'Up to 6 widgets', '4000 messages per month', 'Unlimited agents', 'Up to 10 team members', '50 MB Knowledge Base storage', 'Full integrations', 'Remove widget branding', 'Dedicated support'],
};

const PLAN_PRICES = { free: '$0', starter: '$30', premium: '$110' };
const TIER_LEVELS: Record<string, number> = { free: 0, starter: 1, premium: 2 };

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: string;
  pdf: string | null;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
  const { t, language } = useLanguage();
  const { subscription, workspace, membership } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [creditsCheckoutLoading, setCreditsCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = ['owner', 'admin'].includes(membership?.role ?? 'member');
  const currentPlan = subscription?.plan_tier || 'free';
  const isFreePlan = currentPlan === 'free';
  const usagePercent = subscription
    ? Math.min(Math.round((subscription.messages_used / subscription.messages_limit) * 100), 100)
    : 0;

  // ─── Show toast from Stripe redirect params ──────────────────────────────
  useEffect(() => {
    const creditsStatus = searchParams.get('credits');

    if (creditsStatus === 'success') {
      setToast({ type: 'success', message: t('settings.billing.extraCreditsSuccess') });
      router.refresh();
      router.replace('/settings/billing');
    } else if (creditsStatus === 'canceled') {
      setToast({ type: 'error', message: t('settings.billing.extraCreditsCanceled') });
      router.replace('/settings/billing');
    } else if (searchParams.get('success') === 'true') {
      setToast({ type: 'success', message: '🎉 Plan upgraded successfully! Welcome aboard.' });
      router.replace('/settings/billing');
    } else if (searchParams.get('canceled') === 'true') {
      setToast({ type: 'error', message: 'Checkout canceled. No changes were made.' });
      router.replace('/settings/billing');
    }
  }, [searchParams, router, t]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ─── Fetch real invoices from Stripe ─────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/billing/invoices?workspaceId=${workspace.id}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    } catch {
      // Silently fail — invoices are non-critical
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ─── Handle plan upgrade via Stripe Checkout ─────────────────────────────
  async function handleUpgrade(plan: string) {
    if (plan === currentPlan || plan === 'free') return;

    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, workspaceId: workspace.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error ?? 'Failed to start checkout.' });
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch {
      setToast({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setCheckoutLoading(null);
    }
  }

  // ─── Open Stripe Customer Portal ──────────────────────────────────────────
  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error ?? 'Failed to open billing portal.' });
        return;
      }

      window.location.href = data.url;

    } catch {
      setToast({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleExtraCreditsCheckout() {
    if (isFreePlan || !isAdmin || creditsCheckoutLoading) return;

    setCreditsCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing/extra-credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({
          type: 'error',
          message: data.error ?? t('settings.billing.extraCreditsCheckoutError'),
        });
        return;
      }

      window.location.href = data.url;
    } catch {
      setToast({ type: 'error', message: t('settings.billing.extraCreditsCheckoutError') });
    } finally {
      setCreditsCheckoutLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-page max-w-4xl">

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl text-sm font-semibold transition-all animate-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-error/10 text-error border border-error/20'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page header */}
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

        {/* Extra Credits */}
        <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isFreePlan ? 'bg-surface-container text-on-surface-variant' : 'bg-primary/10 text-primary'
              }`}>
                {isFreePlan ? <LockKeyhole className="h-6 w-6" /> : <Coins className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  {t('settings.billing.extraCreditsTitle')}
                </p>
                <h2 className="mt-2 text-lg font-bold text-on-surface">
                  {isFreePlan
                    ? t('settings.billing.extraCreditsLockedTitle')
                    : t('settings.billing.extraCreditsPackTitle', {
                        amount: EXTRA_MESSAGE_CREDIT_PACK_AMOUNT,
                      })}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  {isFreePlan
                    ? t('settings.billing.extraCreditsLockedDescription')
                    : t('settings.billing.extraCreditsDescription', {
                        amount: EXTRA_MESSAGE_CREDIT_PACK_AMOUNT,
                      })}
                </p>
              </div>
            </div>

            {isFreePlan ? (
              <button
                type="button"
                onClick={() => handleUpgrade('starter')}
                disabled={!isAdmin || checkoutLoading === 'starter'}
                className="app-primary-button rounded-2xl px-5 disabled:cursor-not-allowed disabled:opacity-50"
                title={!isAdmin ? t('settings.billing.extraCreditsAdminOnly') : undefined}
              >
                {checkoutLoading === 'starter' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isAdmin
                  ? t('settings.billing.extraCreditsUpgradeCta')
                  : t('settings.billing.extraCreditsAdminOnly')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExtraCreditsCheckout}
                disabled={!isAdmin || creditsCheckoutLoading}
                className="app-primary-button rounded-2xl px-5 disabled:cursor-not-allowed disabled:opacity-50"
                title={!isAdmin ? t('settings.billing.extraCreditsAdminOnly') : undefined}
              >
                {creditsCheckoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Coins className="h-4 w-4" />
                )}
                {isAdmin
                  ? creditsCheckoutLoading
                    ? t('settings.billing.extraCreditsRedirecting')
                    : t('settings.billing.extraCreditsButton', {
                        amount: EXTRA_MESSAGE_CREDIT_PACK_AMOUNT,
                      })
                  : t('settings.billing.extraCreditsAdminOnly')}
              </button>
            )}
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
                <p className="text-xl font-bold text-on-surface capitalize">
                  {currentPlan} Plan
                </p>
                <p className="text-sm text-on-surface-variant">
                  {PLAN_PRICES[currentPlan as keyof typeof PLAN_PRICES]}/mo · Billed monthly
                </p>
              </div>
            </div>
            {/* Manage Billing Portal button — only for paid plans */}
            {currentPlan !== 'free' && (
              <button
                onClick={handlePortal}
                disabled={!isAdmin || portalLoading}
                className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
                title={!isAdmin ? 'Only workspace admins can manage billing' : undefined}
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isAdmin ? 'Manage Billing' : 'Admin Only'}
              </button>
            )}
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
              <h3 className="text-lg font-bold text-on-surface capitalize">{plan}</h3>
              <p className="mt-1 text-sm text-on-surface-variant leading-tight">
                {t(`settings.billing.plans.${plan}Desc`)}
              </p>
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

              {(() => {
                const isDowngrade = TIER_LEVELS[plan] < TIER_LEVELS[currentPlan];
                const buttonDisabled = !isAdmin || currentPlan === plan || checkoutLoading === plan || (portalLoading && isDowngrade);

                return (
                  <button
                    disabled={buttonDisabled}
                    onClick={() => isDowngrade ? handlePortal() : handleUpgrade(plan)}
                    title={!isAdmin ? 'Only workspace admins can change plans' : undefined}
                    className={`mt-8 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                      currentPlan === plan
                        ? 'bg-surface-container text-on-surface-variant cursor-default'
                        : !isAdmin
                        ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'
                        : isDowngrade
                        ? 'bg-surface-container hover:bg-surface-container-highest text-on-surface transition-colors disabled:opacity-60'
                        : 'app-primary-surface disabled:opacity-60'
                    }`}
                  >
                    {checkoutLoading === plan || (portalLoading && isDowngrade) ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Redirecting…
                      </>
                    ) : currentPlan === plan ? (
                      t('common.active')
                    ) : !isAdmin ? (
                      'Admin Only'
                    ) : isDowngrade ? (
                      plan === 'free' ? 'Cancel Subscription' : `Downgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
                    ) : (
                      `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
                    )}
                  </button>
                );
              })()}
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
                {currentPlan === 'free' ? (
                  <>
                    <p className="text-sm font-bold text-on-surface-variant">No payment method</p>
                    <p className="text-xs text-on-surface-variant">Upgrade to a paid plan to add a card</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-on-surface">Card on file</p>
                    <p className="text-xs text-on-surface-variant">Managed securely through Stripe</p>
                  </>
                )}
              </div>
            </div>
            {currentPlan !== 'free' && (
              <button
                onClick={handlePortal}
                disabled={!isAdmin || portalLoading}
                title={!isAdmin ? 'Only workspace admins can manage billing' : undefined}
                className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-background px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isAdmin ? t('settings.billing.updatePayment') : 'Admin Only'}
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
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-on-surface-variant text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading invoices…
              </div>
            ) : invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                No invoices yet.{currentPlan === 'free' ? ' Upgrade to a paid plan to see your billing history.' : ''}
              </p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/10">
                    <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Date</th>
                    <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Amount</th>
                    <th className="pb-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Status</th>
                    <th className="pb-4 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="group">
                      <td className="py-4 text-sm text-on-surface">{invoice.date}</td>
                      <td className="py-4 text-sm text-on-surface">{invoice.amount}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                          invoice.status === 'Paid'
                            ? 'bg-success/10 text-success'
                            : invoice.status === 'Open'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {invoice.pdf && (
                          <a
                            href={invoice.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t('common.download')}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
