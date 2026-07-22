"use client";

import { useMemo, useState } from "react";
import { getMissingVariableKeys, keyToLabel, type TemplateVariable } from "@/lib/template-variables";

interface TemplateVariableSetupProps {
  /** Template name shown in the header */
  templateName: string;
  /** Variables detected from the template's instructions */
  variables: TemplateVariable[];
  /** Called when the user hits Import — passes resolved values */
  onImport: (values: Record<string, string>) => void;
  /** Called when the user hits the back arrow */
  onBack: () => void;
  /** Whether the import is in-progress */
  isImporting: boolean;
}

/**
 * Full-pane setup step shown inside the Agent Library dialog when a template
 * contains {{variable}} tokens. The user fills in each field before importing.
 */
export function TemplateVariableSetup({
  templateName,
  variables,
  onImport,
  onBack,
  isImporting,
}: TemplateVariableSetupProps) {
  // Initialize values from variable keys — empty strings by default
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.key, ""])),
  );

  const missingKeys = useMemo(
    () => getMissingVariableKeys(variables.map((v) => v.key), values),
    [variables, values],
  );

  const isReady = missingKeys.length === 0;

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col" style={{ animation: "setupSlideIn 0.22s cubic-bezier(0.16,1,0.3,1) both" }}>
      <style>{`
        @keyframes setupSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <button
          onClick={onBack}
          disabled={isImporting}
          aria-label="Back"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant/60 transition-colors hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div>
          <h2 className="text-base font-black tracking-tight text-on-surface">{templateName}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-on-surface-variant/60">
            This template uses {variables.length} customisable{" "}
            {variables.length === 1 ? "field" : "fields"}. Fill them in to personalise your agent.
          </p>
        </div>
      </div>

      {/* Variable fields */}
      <div className="space-y-4">
        {variables.map((variable) => (
          <div key={variable.key}>
            <label
              htmlFor={`var-${variable.key}`}
              className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50"
            >
              {/* Show the label if available, otherwise humanise the key */}
              {variable.label || keyToLabel(variable.key)}
            </label>
            <input
              id={`var-${variable.key}`}
              type="text"
              value={values[variable.key] ?? ""}
              onChange={(e) => handleChange(variable.key, e.target.value)}
              disabled={isImporting}
              placeholder={`Enter ${variable.label || keyToLabel(variable.key)}…`}
              className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3.5 text-sm font-medium text-on-surface shadow-sm outline-none transition-all placeholder:text-on-surface-variant/35 focus:border-primary/40 focus:ring-4 focus:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {variable.description && (
              <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-on-surface-variant/50">
                {variable.description}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Import button */}
      <div className="mt-8">
        <button
          onClick={() => onImport(values)}
          disabled={!isReady || isImporting}
          className="app-primary-surface relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-xs font-bold uppercase tracking-[0.16em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isImporting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              Importing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">download</span>
              Import Agent
            </>
          )}
        </button>

        {!isReady && !isImporting && (
          <p className="mt-3 text-center text-[11px] text-on-surface-variant/50">
            Fill in all fields above to continue
          </p>
        )}
      </div>
    </div>
  );
}
