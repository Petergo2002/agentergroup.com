'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Check, Moon, Sun, UploadCloud } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';

const fieldLabelClassName = 'text-xs font-bold text-on-surface';
const inputFieldClassName =
  'h-10 w-full rounded-xl border border-outline-variant/20 bg-background px-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';
const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;

const BRAND_PALETTES = [
  { name: 'Avenro Orange', color: '#ff5c02' },
  { name: 'Midnight', color: '#0f172a' },
  { name: 'Nordic Blue', color: '#2563eb' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Warm Amber', color: '#d97706' },
  { name: 'Crimson', color: '#e11d48' },
];

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const commitDraft = (nextValue: string) => {
    const normalized = normalizeHexColor(nextValue);
    if (!normalized) return false;
    onChange(normalized);
    setDraft(normalized.toUpperCase());
    return true;
  };

  return (
    <div className="space-y-2">
      <span className={fieldLabelClassName}>{label}</span>
      <div className="flex items-center gap-2.5">
        <div className="relative h-10 w-10 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-full w-full rounded-xl border border-outline-variant/25 shadow-xs transition-transform hover:scale-105"
            style={{ backgroundColor: value }}
            aria-label={`Choose ${label.toLowerCase()}`}
          />
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(event) => commitDraft(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft(nextValue);
              void commitDraft(nextValue);
            }}
            onBlur={() => {
              if (!commitDraft(draft)) {
                setDraft(value.toUpperCase());
              }
            }}
            placeholder="#FF5C02"
            className={inputFieldClassName}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

export function AppearanceTab() {
  const { t } = useLanguage();
  const { form, setForm, isUploadingLogo, handleLogoUpload, logoInputRef } = useWidgetBuilder();

  if (!form) return null;

  const updateColor = (key: 'primaryColor' | 'secondaryColor', val: string) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, [key]: val };
      if (key === 'primaryColor' && current.secondaryColor === current.primaryColor) {
        next.secondaryColor = val;
      }
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Brand Identity Section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-on-surface">
            {t('widgetBuilder.appearance.identityBranding')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.appearance.identityDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/60 p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Logo Upload */}
          <div className="space-y-2.5">
            <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.brandLogo')}</span>
            <div className="flex items-center gap-4">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low transition-all hover:border-primary/50 hover:bg-surface-container"
              >
                {form.logoUrl ? (
                  <>
                    <Image
                      src={form.logoUrl}
                      alt={t('widgetBuilder.appearance.logoPreviewAlt')}
                      fill
                      sizes="64px"
                      className="object-contain p-2"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <UploadCloud className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-on-surface-variant/40 transition-colors group-hover:text-primary">
                    <UploadCloud className="h-5 w-5" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Logo</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="h-8 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingLogo ? t('common.uploading') : t('widgetBuilder.appearance.uploadImage')}
                  </button>
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((c) => (c ? { ...c, logoUrl: '' } : c))}
                      className="h-8 rounded-lg px-2.5 text-xs font-medium text-on-surface-variant/70 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-on-surface-variant/60">
                  {t('widgetBuilder.appearance.optimizedLogo')}
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-outline-variant/10" />

          {/* Brand Name Input */}
          <div className="space-y-1.5">
            <label className="block space-y-1.5">
              <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.brandName')}</span>
              <input
                value={form.brandName}
                onChange={(e) => setForm((c) => (c ? { ...c, brandName: e.target.value } : c))}
                placeholder={t('widgetBuilder.appearance.brandNamePlaceholder')}
                className={inputFieldClassName}
              />
            </label>
            <p className="text-[11px] text-on-surface-variant/60">
              Displayed prominently in the header of the chat widget.
            </p>
          </div>
        </div>
      </section>

      {/* Visual Tone & Colors Section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-on-surface">
            {t('widgetBuilder.appearance.visualTone')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.appearance.visualToneDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/60 p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Quick Curated Color Presets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={fieldLabelClassName}>Curated Brand Presets</span>
              <span className="text-[11px] text-on-surface-variant/50">Click to apply</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BRAND_PALETTES.map((preset) => {
                const isSelected = form.primaryColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => updateColor('primaryColor', preset.color)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-on-surface shadow-2xs font-bold ring-1 ring-primary/30'
                        : 'border-outline-variant/15 bg-surface-container-low/70 text-on-surface-variant hover:border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3.5 w-3.5 rounded-full shadow-2xs shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-outline-variant/10" />

          {/* Custom Color Pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label={t('widgetBuilder.appearance.primarySignature')}
              value={form.primaryColor}
              onChange={(value) => updateColor('primaryColor', value)}
            />

            <ColorField
              label={t('widgetBuilder.appearance.secondaryTint')}
              value={form.secondaryColor}
              onChange={(value) => updateColor('secondaryColor', value)}
            />
          </div>
        </div>
      </section>

      {/* Surface Theme Selection (Visual Cards) */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-on-surface">
            {t('widgetBuilder.appearance.surfaceTheme')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.appearance.themeDescription')}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => setForm((c) => (c ? { ...c, theme: 'light' } : c))}
            className={`group relative flex flex-col rounded-2xl border p-4 text-left transition-all cursor-pointer ${
              form.theme === 'light'
                ? 'border-primary bg-primary/[0.04] shadow-xs ring-2 ring-primary/25'
                : 'border-outline-variant/15 bg-surface-container-lowest/60 hover:border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-on-surface">Light Theme</span>
              </div>
              <span
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  form.theme === 'light' ? 'border-primary bg-primary text-white' : 'border-outline-variant/30'
                }`}
              >
                {form.theme === 'light' && <Check className="h-2.5 w-2.5" />}
              </span>
            </div>

            {/* Mini Light Illustration */}
            <div className="mt-3 rounded-xl border border-black/10 bg-white p-2.5 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-black/5 pb-1.5">
                <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: form.primaryColor }} />
                <div className="h-1.5 w-14 rounded-full bg-slate-200" />
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-20 rounded-full bg-slate-100" />
                <div
                  className="h-1.5 w-12 rounded-full ml-auto"
                  style={{ backgroundColor: `${form.primaryColor}30` }}
                />
              </div>
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => setForm((c) => (c ? { ...c, theme: 'dark' } : c))}
            className={`group relative flex flex-col rounded-2xl border p-4 text-left transition-all cursor-pointer ${
              form.theme === 'dark'
                ? 'border-primary bg-primary/[0.04] shadow-xs ring-2 ring-primary/25'
                : 'border-outline-variant/15 bg-surface-container-lowest/60 hover:border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-bold text-on-surface">Dark Theme</span>
              </div>
              <span
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  form.theme === 'dark' ? 'border-primary bg-primary text-white' : 'border-outline-variant/30'
                }`}
              >
                {form.theme === 'dark' && <Check className="h-2.5 w-2.5" />}
              </span>
            </div>

            {/* Mini Dark Illustration */}
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-900 p-2.5 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-white/10 pb-1.5">
                <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: form.primaryColor }} />
                <div className="h-1.5 w-14 rounded-full bg-slate-700" />
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-20 rounded-full bg-slate-800" />
                <div
                  className="h-1.5 w-12 rounded-full ml-auto"
                  style={{ backgroundColor: `${form.primaryColor}50` }}
                />
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
