"use client";

import { FileText, Upload, Cloud, Globe } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface SourceBentoGridProps {
  onAddText: () => void;
  onUploadFile: () => void;
  onCloudImport: () => void;
  onScrapeWebsite: () => void;
}

export function SourceBentoGrid({ onAddText, onUploadFile, onCloudImport, onScrapeWebsite }: SourceBentoGridProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <button
        type="button"
        onClick={onAddText}
        className="group flex min-h-32 flex-col justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-left shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-on-surface">{t("knowledge.writeText")}</h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant/70">{t("knowledge.pastePolicies")}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onScrapeWebsite}
        className="group flex min-h-32 flex-col justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-left shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-on-surface">{t("knowledge.scrapeWebsite")}</h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant/70">{t("knowledge.websiteUrl")}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onUploadFile}
        className="group flex min-h-32 flex-col justify-between rounded-2xl border border-primary/20 bg-primary/8 p-5 text-left shadow-sm transition-colors hover:bg-primary/12 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-on-surface">{t("knowledge.uploadFiles")}</h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant/70">{t("knowledge.supportTypes")}</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onCloudImport}
        className="group flex min-h-32 flex-col justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-left shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/10 group-hover:text-primary">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-on-surface">{t("knowledge.cloudImport")}</h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant/70">{t("knowledge.driveAndMore")}</p>
        </div>
      </button>
    </div>
  );
}
