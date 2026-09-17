"use client";

import { useState } from "react";
import { BookOpenCheck, Check, CheckCheck, HelpCircle, RotateCcw } from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { ProductFrame, type StoryCopy } from "./ProductUI";
import s from "./product-story.module.css";

export function ImproveScene({ copy }: { copy: StoryCopy }) {
  const [approved, setApproved] = useState(true);
  const improve = copy.improve;

  return (
    <ProductFrame copy={copy} title={improve.badge} className={s.improveFrame}>
      <div className={s.improveContainer}>
        <div className={s.improveFlow}>
          {/* 1. Captured Question */}
          <div className={s.improveCard}>
            <div className={s.cardTopline}>
              <span className={s.cardBadge}>
                <HelpCircle size={14} />
                {improve.questionLabel}
              </span>
              <span className={approved ? s.statusResolved : s.statusPending}>
                {approved ? <Check size={12} /> : null}
                {approved ? improve.approved : improve.status}
              </span>
            </div>
            <p className={s.improveQuestion}>&quot;{improve.question}&quot;</p>
            <div className={s.cardMeta}>
              <span className={s.avatar}>V</span>
              <div>
                <strong>avenro.se</strong>
                <small>Website visitor · 14:22</small>
              </div>
            </div>
          </div>

          {/* 2. The Feedback Bridge */}
          <div className={s.improveBridge} aria-hidden="true">
            <span />
            <div className={s.improveLogoPulse}>
              <MiloLogo size={36} />
            </div>
            <span />
          </div>

          {/* 3. Operator Verified Answer & Knowledge Sync */}
          <div className={`${s.improveCard} ${approved ? s.improveCardActive : ""}`}>
            <div className={s.cardTopline}>
              <span className={s.cardBadge}>
                <BookOpenCheck size={14} />
                {improve.answerLabel}
              </span>
              <span className={s.example}>{copy.example}</span>
            </div>
            <p className={s.improveAnswer}>{improve.answer}</p>
            <div className={s.cardActionRow}>
              <button
                type="button"
                className={approved ? s.approvedButton : s.approveButton}
                onClick={() => setApproved(!approved)}
                aria-pressed={approved}
              >
                {approved ? <Check size={15} /> : <CheckCheck size={15} />}
                <span>{approved ? improve.approved : improve.approve}</span>
              </button>
              {approved && (
                <button
                  type="button"
                  className={s.retestButton}
                  onClick={() => setApproved(false)}
                  title="Reset demo"
                  aria-label="Reset demo"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Callout & Metric */}
        <div className={s.improveOutcome}>
          <div className={s.outcomeMetric}>
            <CheckCheck size={18} className={s.outcomeIcon} />
            <strong>{improve.metric}</strong>
          </div>
          <p>{improve.metricDetail}</p>
        </div>
      </div>
    </ProductFrame>
  );
}
