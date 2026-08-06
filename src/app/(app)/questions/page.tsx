import { getAppRequestContext } from "@/lib/app/request-context";
import {
  countFlywheelQuestions,
  listFlywheelQuestions,
} from "@/lib/flywheel/server";
import type { FlywheelQuestionListItem } from "@/lib/types";
import { WORKSPACE_AGENT_LIST_LIMIT, WORKSPACE_WIDGET_LIST_LIMIT } from "@/lib/query-limits";
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
  const { supabase, user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

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
      .order("name", { ascending: true })
      .limit(WORKSPACE_AGENT_LIST_LIMIT),
    supabase
      .from("widgets")
      .select("id, name")
      .eq("workspace_id", context.workspace.id)
      .order("name", { ascending: true })
      .limit(WORKSPACE_WIDGET_LIST_LIMIT),
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
