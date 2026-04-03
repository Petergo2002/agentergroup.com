"use client";

import { FileText, Upload, Cloud, MoveRight } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface SourceBentoGridProps {
  onAddText: () => void;
  onUploadFile: () => void;
  onCloudImport: () => void;
}

export function SourceBentoGrid({ onAddText, onUploadFile, onCloudImport }: SourceBentoGridProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[160px]">
      {/* Write Text Card */}
      <button
        onClick={onAddText}
        className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-low p-6 transition-all hover:bg-surface-container active:scale-[0.98] md:col-span-1"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm transition-transform duration-300 group-hover:scale-110">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">{t("knowledge.writeText")}</h3>
          <p className="mt-1 text-xs text-on-surface-variant/70">{t("knowledge.pastePolicies")}</p>
        </div>
        <MoveRight className="absolute bottom-6 right-6 h-4 w-4 text-primary opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </button>

      {/* Upload Files Card */}
      <button
        onClick={onUploadFile}
        className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-primary-container p-6 transition-all hover:brightness-105 active:scale-[0.98] md:col-span-2"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-left">
          <h3 className="text-sm font-bold text-white">{t("knowledge.uploadFiles")}</h3>
          <p className="mt-1 text-xs text-white/80">{t("knowledge.supportTypes")}</p>
        </div>
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
          <Upload className="h-32 w-32 text-white" />
        </div>
        <MoveRight className="absolute bottom-6 right-6 h-4 w-4 text-white opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </button>

      {/* Cloud Import Card */}
      <button
        onClick={onCloudImport}
        className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-low p-6 transition-all hover:bg-surface-container active:scale-[0.98] md:col-span-1"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:text-primary">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">{t("knowledge.cloudImport")}</h3>
          <p className="mt-1 text-xs text-on-surface-variant/70">{t("knowledge.driveAndMore")}</p>
        </div>
        <MoveRight className="absolute bottom-6 right-6 h-4 w-4 text-primary opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </button>
    </div>
  );
}
