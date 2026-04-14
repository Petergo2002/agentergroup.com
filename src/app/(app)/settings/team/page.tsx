'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';

const TEAM_MEMBERS = [
  { id: '1', name: 'Peter Gorgees', email: 'peter@agentergroup.com', role: 'owner', initials: 'PG' },
  { id: '2', name: 'John Doe', email: 'john@example.com', role: 'member', initials: 'JD' },
  { id: '3', name: 'Sarah Smith', email: 'sarah@example.com', role: 'member', initials: 'SS' },
];

export default function TeamSettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {t('settings.team.badge')}
          </p>
          <h1 className="mt-3 font-headline text-[2.15rem] font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            {t('settings.team.title')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {t('settings.team.description')}
          </p>
        </div>
        <button className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90">
          {t('settings.team.invite')}
        </button>
      </div>

      <div className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest overflow-hidden shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t('common.member') || 'Member'}
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t('common.role') || 'Role'}
                </th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {TEAM_MEMBERS.map((member) => (
                <tr key={member.id} className="group hover:bg-surface-container/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {member.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-on-surface">{member.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      member.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {t(`roles.${member.role}Lower`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-semibold text-error/70 hover:text-error transition-colors">
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
