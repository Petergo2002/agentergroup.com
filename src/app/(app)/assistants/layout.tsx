import { redirect } from "next/navigation";
import { hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";
import { getAppRequestContext } from "@/lib/app/request-context";

export default async function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, context } = await getAppRequestContext();

  if (!user || !context) {
    redirect("/login");
  }

  if (!hasInternalAssistantsEnabled(context.workspace)) {
    redirect("/dashboard");
  }

  return children;
}
