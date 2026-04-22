"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Marks the current workspace as onboarding completed.
 * This is used for the "Free" plan or after a successful paid signup
 * (though paid signup is usually handled by the webhook, we might want
 * to mark it proactively if we return from Stripe).
 */
export async function completeOnboarding(workspaceId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({ onboarding_completed: true })
    .eq("id", workspaceId);

  if (error) {
    console.error("Failed to complete onboarding:", error);
    throw new Error("Failed to update workspace state.");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
