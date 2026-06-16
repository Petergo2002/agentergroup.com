import type Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getOrCreateWorkspaceStripeCustomer(input: {
  stripe: Stripe;
  workspaceId: string;
  user: User;
  existingCustomerId?: string | null;
}) {
  if (input.existingCustomerId) {
    return input.existingCustomerId;
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", input.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load billing profile: ${profileError.message}`);
  }

  const customer = await input.stripe.customers.create(
    {
      email: profile?.email ?? input.user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: {
        workspace_id: input.workspaceId,
        user_id: input.user.id,
      },
    },
    {
      idempotencyKey: `workspace:${input.workspaceId}:stripe-customer`,
    },
  );

  const { data: updatedSubscription, error: updateError } = await admin
    .from("workspace_subscriptions")
    .update({ stripe_customer_id: customer.id })
    .eq("workspace_id", input.workspaceId)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .maybeSingle();

  if (updateError) {
    throw new Error(
      `Failed to persist Stripe customer id: ${updateError.message}`,
    );
  }

  if (updatedSubscription?.stripe_customer_id) {
    return updatedSubscription.stripe_customer_id;
  }

  const { data: existingSubscription, error: reloadError } = await admin
    .from("workspace_subscriptions")
    .select("stripe_customer_id")
    .eq("workspace_id", input.workspaceId)
    .single();

  if (reloadError || !existingSubscription?.stripe_customer_id) {
    throw new Error(
      reloadError?.message ?? "Stripe customer id was not persisted.",
    );
  }

  return existingSubscription.stripe_customer_id;
}
