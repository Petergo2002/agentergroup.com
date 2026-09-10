"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureWorkspaceContext,
  invalidateWorkspaceContextCache,
} from "@/lib/app/bootstrap";
import {
  createLegalConsentToken,
  recordLegalAcceptance,
} from "@/lib/legal-consent";

export interface OnboardingActionState {
  success?: boolean;
  error?: string;
  notice?: string;
}

export async function updateOnboardingDetails(
  prevState: OnboardingActionState | null,
  formData: FormData,
): Promise<OnboardingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Session expired. Please sign in again." };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const acceptTerms = formData.get("acceptTerms") === "on";

  if (!fullName) {
    return { success: false, error: "Please enter your full name." };
  }

  if (!companyName) {
    return { success: false, error: "Please enter your company name." };
  }

  try {
    // 1. Update user profile in database
    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);

    // 2. Update Supabase Auth user metadata
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        name: fullName,
        workspace_name: companyName,
      },
    });

    // 3. Update workspace name
    await supabase
      .from("workspaces")
      .update({ name: companyName })
      .eq("id", context.workspace.id);

    // 4. Record legal consent if submitted and not already recorded
    if (acceptTerms) {
      const adminClient = createAdminClient();
      const { data: existingConsent } = await adminClient
        .from("user_legal_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingConsent) {
        try {
          const token = createLegalConsentToken("google_oauth");
          await recordLegalAcceptance({
            supabase: adminClient,
            userId: user.id,
            token,
          });
        } catch (consentErr) {
          console.warn("[Onboarding] Error recording legal consent:", consentErr);
        }
      }
    }

    // Invalidate cached workspace context so updates appear immediately
    invalidateWorkspaceContextCache(user.id);
    revalidatePath("/onboarding");

    return {
      success: true,
      notice: "Your details have been saved successfully.",
    };
  } catch (error) {
    console.error("[Onboarding] Failed to update details:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save your details right now. Please try again.",
    };
  }
}
