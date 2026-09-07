'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';

const fieldLabelClassName = 'text-xs font-semibold text-on-surface-variant';
const inputContainerClassName = 'space-y-2';
const inputFieldClassName = 'h-11 w-full rounded-xl border border-outline-variant/20 bg-background px-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';
const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;

function normalizeHexColor(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

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

    if (!normalized) {
      return false;
    }

    onChange(normalized);
    setDraft(normalized.toUpperCase());
    return true;
  };

  return (
    <label className="block space-y-3">
      <span className={fieldLabelClassName}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-full w-full rounded-xl border border-outline-variant/20 shadow-sm transition-transform hover:scale-[1.03]"
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
            placeholder="#FF6B00"
            className={inputFieldClassName}
            spellCheck={false}
          />
        </div>
      </div>
    </label>
  );
}

export function AppearanceTab() {
  const { t } = useLanguage();
  const { form, setForm, isUploadingLogo, handleLogoUpload, logoInputRef } = useWidgetBuilder();

  if (!form) return null;

  const updateColor = (key: 'primaryColor' | 'secondaryColor', val: string) => {
    setForm(current => {
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
      {/* Branding Section */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.appearance.identityBranding')}</h2>
          <p className="text-sm text-on-surface-variant/60">{t('widgetBuilder.appearance.identityDescription')}</p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            {/* Logo Upload */}
            <div className="space-y-3">
              <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.brandLogo')}</span>
              <div className="flex items-center gap-4">
                <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low transition-all hover:border-primary/30">
                  {form.logoUrl ? (
                    <Image
                      src={form.logoUrl}
                      alt={t('widgetBuilder.appearance.logoPreviewAlt')}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-container-low">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/30">{t('widgetBuilder.appearance.noLogo')}</span>
                    </div>
                  )}
                  <div 
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-[2px]"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{t('widgetBuilder.appearance.change')}</span>
                  </div>
                </div>
                <div className="space-y-2">
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
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="h-9 rounded-lg border border-outline-variant/20 bg-background px-3.5 text-xs font-semibold transition-colors hover:bg-surface-container-low"
                  >
                    {isUploadingLogo ? t('common.uploading') : t('widgetBuilder.appearance.uploadImage')}
                  </button>
                  <p className="max-w-[180px] text-xs leading-relaxed text-on-surface-variant/55">
                    {t('widgetBuilder.appearance.optimizedLogo')}
                  </p>
                </div>
              </div>
            </div>

            {/* Brand Name */}
            <div className={inputContainerClassName}>
              <label className="block space-y-3">
                <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.brandName')}</span>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm(c => c ? { ...c, brandName: e.target.value } : c)}
                  placeholder={t('widgetBuilder.appearance.brandNamePlaceholder')}
                  className={inputFieldClassName}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Colors Section */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.appearance.visualTone')}</h2>
          <p className="text-sm text-on-surface-variant/60">{t('widgetBuilder.appearance.visualToneDescription')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="space-y-5">
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

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.surfaceTheme')}</span>
            <div className="mt-4 flex gap-3">
              {(['light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setForm(c => c ? { ...c, theme } : c)}
                  className={`flex-1 rounded-xl border px-4 py-4 text-center transition-all ${
                    form.theme === theme
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-outline-variant/15 hover:border-outline-variant/30 hover:bg-surface-container-low'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${form.theme === theme ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                    {theme}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-on-surface-variant/55">
              {t('widgetBuilder.appearance.themeDescription')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
