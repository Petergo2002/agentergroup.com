import type { Messages } from "./en";
import { common } from "./sv/common";
import { nav } from "./sv/nav";
import { roles } from "./sv/roles";
import { statuses } from "./sv/statuses";
import { toast } from "./sv/toast";
import { modals } from "./sv/modals";
import { dates } from "./sv/dates";
import { login } from "./sv/login";
import { dashboard } from "./sv/dashboard";
import { leads } from "./sv/leads";
import { analytics } from "./sv/analytics";
import { agents } from "./sv/agents";
import { agentBuilder } from "./sv/agentBuilder";
import { agentPreview } from "./sv/agentPreview";
import { assistants } from "./sv/assistants";
import { widgets } from "./sv/widgets";
import { widgetBuilder } from "./sv/widgetBuilder";
import { knowledge } from "./sv/knowledge";
import { connections } from "./sv/connections";
import { settings } from "./sv/settings";
import { admin } from "./sv/admin";
import { privacyPolicy } from "./sv/privacyPolicy";
import { termsOfService } from "./sv/termsOfService";
import { dataProcessing } from "./sv/dataProcessing";
import { subprocessors } from "./sv/subprocessors";

export const sv = {
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
} satisfies Messages;
