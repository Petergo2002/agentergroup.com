import { redirect } from 'next/navigation';
import { SELF_SERVE_BILLING_ENABLED } from '@/lib/billing-mode';

export default function BillingSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!SELF_SERVE_BILLING_ENABLED) {
    redirect('/settings');
  }

  return children;
}
