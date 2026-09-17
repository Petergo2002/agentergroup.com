import { ArrowDown, ArrowRight, Check, Database, MousePointerClick } from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { SimpleIcon } from "@/components/icons/SimpleIcon";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import type { StoryCopy } from "./ProductUI";
import s from "./product-story.module.css";

export function IntegrationScene({ copy, selected = 0, slot = 0, onSelect }: { copy: StoryCopy; selected?: number; slot?: number; onSelect?: (index: number) => void }) {
  const current = copy.integrations.items[selected];
  return <div className={s.integrationScene}>
    <div className={s.systemDiagram}>
      <div className={s.knowledgeNode}><div><Database size={18} /><span>{copy.integrations.input}</span></div><small><SimpleIcon iconKey="siGoogledrive" size={15} color="#0F9D58" />Google Drive <span>·</span> {copy.knowledge.sources[0].kind}</small></div>
      <div className={s.inputConnection} aria-hidden="true"><ArrowRight size={17} /><ArrowDown size={17} /></div>
      <div className={s.miloNode}><MiloLogo size={68} /><strong>MILO</strong><span>{copy.integrations.hub}</span></div>
      <div className={s.outputConnections} aria-hidden="true"><svg viewBox="0 0 80 240" preserveAspectRatio="none"><path d="M0 120 H35 V40 H80 M35 120 H80 M35 120 V200 H80" /><path key={selected} pathLength="1" className={s.activeConnection} d={selected === 0 ? "M0 120 H35 V40 H80" : selected === 1 ? "M0 120 H80" : "M0 120 H35 V200 H80"} /></svg></div>
      <div className={s.toolNodes} role={onSelect ? "group" : undefined} aria-label={copy.integrations.select}>{onSelect && <p className={s.toolNodesHint}><MousePointerClick size={14} aria-hidden="true" />{copy.integrations.select}</p>}{copy.integrations.items.map((item, i) => {
        const toolkit = SUPPORTED_INTEGRATIONS.find(tool => tool.slug === item.slug)!;
        const content = <><SimpleIcon iconKey={toolkit.simpleIcon} color={toolkit.simpleIconColor} size={22} /><span>{item.label}</span><ArrowRight size={15} /></>;
        return onSelect ? <button type="button" key={item.slug} onClick={() => onSelect(i)} aria-pressed={selected === i}>{content}</button> : <div key={item.slug} data-selected={selected === i}>{content}</div>;
      })}</div>
    </div>
    <div className={s.integrationResult} key={current.slug} aria-live={onSelect ? "polite" : undefined}><div><p className={s.microLabel}>{current.label}</p><h3>{current.action}</h3><p>{current.detail}</p></div><div className={s.toolReceipt}><span><Check size={15} />{current.meta}</span><strong>{current.result}</strong><small>{selected === 0 ? copy.action.slots[slot] : copy.example}</small></div></div>
  </div>;
}
