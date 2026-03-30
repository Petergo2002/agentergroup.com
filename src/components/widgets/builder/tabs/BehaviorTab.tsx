'use client';

import { useWidgetBuilder } from '../WidgetBuilderContext';

const fieldLabelClassName = 'text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1';
const sectionDescClassName = 'text-sm text-on-surface-variant/60 leading-relaxed max-w-2xl';
const inputFieldClassName = 'relative z-10 w-full rounded-[14px] border border-outline-variant/10 bg-background px-5 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30';

export function BehaviorTab() {
  const { form, setForm } = useWidgetBuilder();

  if (!form) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Interaction Logic Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">Interaction Logic</h2>
          <p className={sectionDescClassName}>
             Control how the widget behaves when a user first interacts with it.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
          <div className="grid gap-8 md:grid-cols-2">
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>Primary Language</span>
              <select
                 value={form.language}
                 onChange={(e) => setForm(c => c ? { ...c, language: e.target.value } : c)}
                 className={inputFieldClassName}
              >
                <option value="en">English (default)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
              </select>
            </label>

            <div className="flex items-center justify-between p-6 bg-surface-container-low rounded-[1.8rem] border border-outline-variant/10">
              <div className="space-y-1">
                <span className={fieldLabelClassName}>Show Agenter Branding</span>
                <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.05em] font-medium">Toggle &quot;Powered by Agenter&quot; footer</p>
              </div>
              <button
                onClick={() => setForm(c => c ? { ...c, showBranding: !form.showBranding } : c)}
                className={`relative h-6 w-11 rounded-full p-1 transition-colors ${form.showBranding ? 'bg-primary' : 'bg-on-surface-variant/20'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-background transition-transform ${form.showBranding ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Copywriting Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">Home Screen Copywriting</h2>
          <p className={sectionDescClassName}>
             The initial text shown in the home chooser screen when multiple specialists are active.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
          <div className="grid gap-8">
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>Home Title</span>
              <input
                 type="text"
                 value={form.homeTitle}
                 onChange={(e) => setForm(c => c ? { ...c, homeTitle: e.target.value } : c)}
                 placeholder="e.g. How can we help you today?"
                 className={inputFieldClassName}
              />
            </label>
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>Home Subtitle</span>
              <textarea
                 value={form.homeSubtitle}
                 onChange={(e) => setForm(c => c ? { ...c, homeSubtitle: e.target.value } : c)}
                 className={`${inputFieldClassName} h-24 resize-none`}
                 placeholder="e.g. Select a specialist from our roster to start a conversation."
                 rows={4}
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
