"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { ActionStage } from "./ActionStage";
import { demoReducer, INITIAL_DEMO, shouldAdvanceDemo, STEP_DURATION, type DemoStep } from "./demo-state";
import { useStory } from "./StoryContext";
import type { StoryCopy } from "./ProductUI";
import s from "./product-story.module.css";

export default function ActionDemo({ copy }: { copy: StoryCopy }) {
  const [state, dispatch] = useReducer(demoReducer, INITIAL_DEMO);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const reduced = useRef(true);
  const { setSlot } = useStory();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => { reduced.current = media.matches; if (media.matches) dispatch({ type: "pause" }); };
    motionChange();
    const visibilityChange = () => setPageVisible(!document.hidden);
    visibilityChange();
    document.addEventListener("visibilitychange", visibilityChange);
    media.addEventListener("change", motionChange);
    if (!("IntersectionObserver" in window)) {
      return () => { media.removeEventListener("change", motionChange); document.removeEventListener("visibilitychange", visibilityChange); };
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        if (!reduced.current) dispatch({ type: "play" });
      }
    }, { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); media.removeEventListener("change", motionChange); document.removeEventListener("visibilitychange", visibilityChange); };
  }, []);

  useEffect(() => {
    if (!shouldAdvanceDemo(state, { visible, pageVisible, reducedMotion: reduced.current })) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), STEP_DURATION[state.step]);
    return () => window.clearTimeout(timer);
  }, [state, visible, pageVisible]);

  function selectSlot(slot: number) { started.current = true; setSlot(slot); dispatch({ type: "slot", slot }); }
  function play() {
    started.current = true;
    if (state.step === 4) setSlot(0);
    if (reduced.current) {
      if (state.step === 4) { dispatch({ type: "replay" }); dispatch({ type: "pause" }); }
      else dispatch({ type: "step", step: (state.step + 1) as DemoStep });
    }
    else dispatch({ type: state.playing ? "pause" : "play" });
  }
  function replay() { started.current = true; setSlot(0); dispatch({ type: "replay" }); if (reduced.current) dispatch({ type: "pause" }); }

  return <div ref={root}>
    <ActionStage copy={copy} step={state.step} slot={state.slot} playing={state.playing && visible && pageVisible} onSlot={selectSlot} />
    <div className={s.demoControls}>
      <div className={s.stepButtons} role="group" aria-label={copy.action.stepLabel}>{copy.action.steps.map((label, i) => <button type="button" key={label} aria-pressed={state.step === i} onClick={() => { started.current = true; dispatch({ type: "step", step: i as DemoStep }); }}><span>{String(i + 1).padStart(2, "0")}</span>{label}</button>)}</div>
      <div className={s.playButtons}><button type="button" onClick={play} aria-label={state.playing ? copy.action.pause : copy.action.play}>{state.playing ? <Pause size={17} /> : <Play size={17} />}<span>{state.playing ? copy.action.pause : copy.action.play}</span></button><button type="button" onClick={replay} aria-label={copy.action.replay}><RotateCcw size={17} /></button></div>
    </div>
    <p className={s.screenReader} role="status" aria-live="polite">{copy.action.steps[state.step]}: {copy.action.details[state.step]}</p>
  </div>;
}
