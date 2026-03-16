import { redirect } from "next/navigation";

export default async function LegacyAgentWidgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/widgets?agent=${encodeURIComponent(id)}`);
}
