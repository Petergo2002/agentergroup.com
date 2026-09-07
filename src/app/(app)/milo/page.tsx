import { redirect } from "next/navigation";
import { MiloSetupCard } from "@/components/milo/MiloSetupCard";
import { getAppRequestContext } from "@/lib/app/request-context";

export default async function MiloPage() {
  const { context } = await getAppRequestContext();
  if (!context) redirect("/login");
  if (context.workspace.primary_customer_agent_id) {
    redirect(`/agents/${context.workspace.primary_customer_agent_id}/builder`);
  }
  return <MiloSetupCard canRepair={["owner", "admin"].includes(context.membership.role)} />;
}
