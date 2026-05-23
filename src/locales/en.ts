import { common } from "./en/common";
import { nav } from "./en/nav";
import { roles } from "./en/roles";
import { statuses } from "./en/statuses";
import { toast } from "./en/toast";
import { modals } from "./en/modals";
import { dates } from "./en/dates";
import { login } from "./en/login";
import { dashboard } from "./en/dashboard";
import { leads } from "./en/leads";
import { analytics } from "./en/analytics";
import { agents } from "./en/agents";
import { agentBuilder } from "./en/agentBuilder";
import { agentPreview } from "./en/agentPreview";
import { assistants } from "./en/assistants";
import { widgets } from "./en/widgets";
import { widgetBuilder } from "./en/widgetBuilder";
import { knowledge } from "./en/knowledge";
import { connections } from "./en/connections";
import { settings } from "./en/settings";
import { admin } from "./en/admin";
import { privacyPolicy } from "./en/privacyPolicy";
import { termsOfService } from "./en/termsOfService";
import { dataProcessing } from "./en/dataProcessing";
import { subprocessors } from "./en/subprocessors";

export const en = {
  common,
  nav,
  roles,
  statuses,
  toast,
  modals,
  dates,
  login,
  dashboard,
  leads,
  analytics,
  agents,
  agentBuilder,
  agentPreview,
  assistants,
  widgets,
  widgetBuilder,
  knowledge,
  connections,
  settings,
  admin,
  privacyPolicy,
  termsOfService,
  dataProcessing,
  subprocessors,
} as const;

type DeepWiden<T> =
  T extends string ? string
  : T extends readonly (infer U)[] ? readonly DeepWiden<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepWiden<T[K]> }
  : T;

export type Messages = DeepWiden<typeof en>;
