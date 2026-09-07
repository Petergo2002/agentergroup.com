import { redirect } from "next/navigation";
import { MiloSetupCard } from "@/components/milo/MiloSetupCard";
import { getAppRequestContext } from "@/lib/app/request-context";

export default async function WebsiteChatPage() {
  const { context } = await getAppRequestContext();
  if (!context) redirect("/login");
  if (context.workspace.primary_widget_id) {
    redirect(`/widgets/${context.workspace.primary_widget_id}`);
  }
  return <MiloSetupCard canRepair={["owner", "admin"].includes(context.membership.role)} />;
}
