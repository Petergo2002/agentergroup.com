import { CalendarClock, Check, ChevronRight } from "lucide-react";
import { BookingConfirmation, ChatHeader, GroundedAnswer, LeadSummary, Message, type StoryCopy } from "./ProductUI";
import type { DemoStep } from "./demo-state";
import s from "./product-story.module.css";

export function ActionStage({ copy, step = 0, slot = 0, playing = false, onSlot }: { copy: StoryCopy; step?: DemoStep; slot?: number; playing?: boolean; onSlot?: (slot: number) => void }) {
  return <div className={s.actionStage} data-demo-step={step}>
    <div className={s.actionChat}>
      <ChatHeader copy={copy} />
      <div key={step} className={s.stageContent}>
        {step < 2 && <Message visitor>{copy.visitor.prompt}</Message>}
        {step === 0 && <div className={s.waitingAnswer}><span className={playing ? s.typing : s.typingStill} aria-hidden="true"><i /><i /><i /></span><p>{copy.action.details[0]}</p></div>}
        {step === 1 && <><GroundedAnswer copy={copy} source={copy.knowledge.sources[2].title}><Message>{copy.visitor.answer}</Message></GroundedAnswer><p className={s.stageFollowup}>{copy.visitor.followup}</p></>}
        {step === 2 && <><Message visitor>{copy.action.qualification}</Message><div className={s.needsCaptured}><Check size={17} /><div><strong>{copy.need}</strong><p>{copy.action.summaryNeed}</p></div></div></>}
        {step === 3 && <><Message caption="MILO">{copy.action.reply}</Message><div className={s.calendarPanel}><div className={s.calendarTitle}><CalendarClock size={21} /><div><strong>{copy.action.available}</strong><p>{copy.action.choose}</p></div></div><div className={s.timeSlots}>{copy.action.slots.map((time, i) => onSlot ? <button type="button" key={time} onClick={() => onSlot(i)}>{time}<ChevronRight size={16} /></button> : <span key={time}>{time}</span>)}</div><small>{copy.action.timezone}</small></div></>}
        {step === 4 && <><BookingConfirmation copy={copy} slot={slot} /><LeadSummary copy={copy} slot={slot} compact /></>}
      </div>
    </div>
    <div className={s.actionActivity}>
      <p className={s.microLabel}>{copy.action.activity}</p>
      <ol>{copy.action.events.map((event, i) => <li key={event} data-current={i === step} data-complete={i < step}><span>{i < step ? <Check size={14} /> : String(i + 1).padStart(2, "0")}</span><div><strong>{event}</strong><p>{copy.action.details[i]}</p></div></li>)}</ol>
      <div className={s.activityOutcome}><span>{copy.example}</span><strong>{copy.action.result}</strong><p>{copy.action.resultDetail}</p></div>
    </div>
  </div>;
}
