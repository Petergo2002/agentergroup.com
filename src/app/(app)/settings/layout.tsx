import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="lg:shrink-0 lg:sticky lg:top-0 h-fit lg:h-screen lg:overflow-y-auto">
        <SettingsSidebar />
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
