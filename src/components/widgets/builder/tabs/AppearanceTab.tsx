'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';

const fieldLabelClassName = 'text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1';
const inputContainerClassName = 'space-y-3';
const inputFieldClassName = 'w-full rounded-[14px] border border-outline-variant/10 bg-background px-5 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30';
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
    <label className="block space-y-4">
      <span className={fieldLabelClassName}>{label}</span>
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-full w-full rounded-2xl border border-outline-variant/15 shadow-sm transition-transform hover:scale-[1.03]"
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

        <div className="flex-1 space-y-2">
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:text-on-surface"
          >
            Pick color
          </button>
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
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Branding Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.appearance.identityBranding')}</h2>
          <p className="text-sm text-on-surface-variant/60">{t('widgetBuilder.appearance.identityDescription')}</p>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-premium">
          <div className="grid gap-10 md:grid-cols-2">
            {/* Logo Upload */}
            <div className="space-y-4">
              <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.brandLogo')}</span>
              <div className="flex items-center gap-6">
                <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.6rem] border border-outline-variant/15 bg-surface-container-low transition-all hover:border-primary/30">
                  {form.logoUrl ? (
                    <Image
                      src={form.logoUrl}
                      alt={t('widgetBuilder.appearance.logoPreviewAlt')}
                      fill
                      sizes="96px"
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
                    className="rounded-full border border-outline-variant/15 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-on-surface hover:text-background"
                  >
                    {isUploadingLogo ? t('common.uploading') : t('widgetBuilder.appearance.uploadImage')}
                  </button>
                  <p className="text-[10px] text-on-surface-variant/40 leading-relaxed max-w-[160px]">
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
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.appearance.visualTone')}</h2>
          <p className="text-sm text-on-surface-variant/60">{t('widgetBuilder.appearance.visualToneDescription')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-premium">
            <div className="space-y-6">
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

          <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-low p-8">
            <span className={fieldLabelClassName}>{t('widgetBuilder.appearance.surfaceTheme')}</span>
            <div className="mt-6 flex gap-4">
              {(['light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setForm(c => c ? { ...c, theme } : c)}
                  className={`flex-1 rounded-[1.4rem] border p-6 text-center transition-all ${
                    form.theme === theme 
                      ? 'border-primary bg-background shadow-lg' 
                      : 'border-outline-variant/10 hover:border-outline-variant/30'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${form.theme === theme ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                    {theme}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-on-surface-variant/40 italic leading-relaxed text-center">
              {t('widgetBuilder.appearance.themeDescription')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
