export interface WidgetQuickAction {
  label: string;
  prompt: string;
  icon?: string | null;
}

export interface WidgetContactFormSettingsRecord {
  submitButtonText?: string;
  successMessage?: string;
  introText?: string;
}