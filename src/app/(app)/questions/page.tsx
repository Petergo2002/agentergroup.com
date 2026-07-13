import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  countFlywheelQuestions,
  listFlywheelQuestions,
} from "@/lib/flywheel/server";
import { createClient } from "@/lib/supabase/server";
import type { FlywheelQuestionListItem } from "@/lib/types";
import QuestionsPageClient from "./QuestionsPageClient";

interface QuestionAgentOption {
  id: string;
  name: string;
}

interface QuestionWidgetOption {
  id: string;
  name: string;
}

async function loadQuestionsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const [questions, counts, agentsResult, widgetsResult] = await Promise.all([
    listFlywheelQuestions(supabase as never, {
      workspaceId: context.workspace.id,
      status: "open",
      limit: 150,
    }),
    countFlywheelQuestions(supabase as never, {
      workspaceId: context.workspace.id,
    }),
    supabase
      .from("agents")
      .select("id, name")
      .eq("workspace_id", context.workspace.id)
      .order("name", { ascending: true }),
    supabase
      .from("widgets")
      .select("id, name")
      .eq("workspace_id", context.workspace.id)
      .order("name", { ascending: true }),
  ]);

  if (agentsResult.error) {
    throw agentsResult.error;
  }

  if (widgetsResult.error) {
    throw widgetsResult.error;
  }

  return {
    initialQuestions: questions as FlywheelQuestionListItem[],
    initialCounts: counts,
    agents: (agentsResult.data ?? []) as QuestionAgentOption[],
    widgets: (widgetsResult.data ?? []) as QuestionWidgetOption[],
    workspaceName: context.workspace.name,
  };
}

export default async function QuestionsPage() {
  const data = await loadQuestionsPageData();

  return <QuestionsPageClient {...data} />;
}
