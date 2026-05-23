/**
 * template-variables.ts
 *
 * Pure utility functions for {{variable}} token handling in agent prompt templates.
 * No external dependencies — safe to use in both client and server contexts.
 */

export interface TemplateVariable {
  /** The raw token key, e.g. "company_name" */
  key: string;
  /** Human-readable label shown to the importer, e.g. "Company Name" */
  label: string;
  /** Optional hint shown below the input field */
  description?: string;
}

/** Regex that matches {{variable_name}} tokens (letters, digits, underscores) */
const TOKEN_REGEX = /\{\{([a-z][a-z0-9_]*)\}\}/gi;

/**
 * Parse all unique {{variable}} tokens from a prompt string.
 * Returns them in the order they first appear.
 */
export function parseVariableKeys(text: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex because we reuse the same regex constant
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Convert a snake_case key into a human-readable label.
 * "company_name" → "Company Name"
 */
export function keyToLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a TemplateVariable array from a prompt string.
 * Used both by the editor (to show the variable list) and by the submit API.
 */
export function parseTemplateVariables(text: string): TemplateVariable[] {
  return parseVariableKeys(text).map((key) => ({
    key,
    label: keyToLabel(key),
  }));
}

/**
 * Substitute all {{key}} tokens in a string with values from the provided map.
 * Keys not present in the map are left as-is.
 */
export function resolveTemplateVariables(
  text: string,
  values: Record<string, string>,
): string {
  // Reset lastIndex to avoid stale state from the shared global regex
  TOKEN_REGEX.lastIndex = 0;
  return text.replace(TOKEN_REGEX, (_match, key: string) => {
    return values[key.toLowerCase()] ?? _match;
  });
}

/**
 * Returns the keys of all variables that have an empty or missing value.
 */
export function getMissingVariableKeys(
  keys: string[],
  values: Record<string, string>,
): string[] {
  return keys.filter((key) => !values[key]?.trim());
}
