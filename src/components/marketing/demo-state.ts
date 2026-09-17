export type DemoStep = 0 | 1 | 2 | 3 | 4;
export interface DemoState { step: DemoStep; slot: number; playing: boolean }
export type DemoAction = { type: "tick" } | { type: "step"; step: DemoStep } | { type: "slot"; slot: number } | { type: "play" } | { type: "pause" } | { type: "replay" };
export const INITIAL_DEMO: DemoState = { step: 0, slot: 0, playing: false };
export const DEMO_CONTACT = { name: "Alex", email: "alex@example.com" } as const;
export const DEMO_METRICS = [1, 6, 1] as const;
export const STEP_DURATION = [3200, 4600, 4200, 6000, 0] as const;
export function shouldAdvanceDemo(state: DemoState, environment: { visible: boolean; pageVisible: boolean; reducedMotion: boolean }) {
  return state.playing && state.step < 4 && environment.visible && environment.pageVisible && !environment.reducedMotion;
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "tick": {
      if (!state.playing || state.step === 4) return state;
      const step = (state.step + 1) as DemoStep;
      return { ...state, step, playing: step < 4 };
    }
    case "step": return { ...state, step: action.step, playing: false };
    case "slot": return action.slot === 0 || action.slot === 1 ? { step: 4, slot: action.slot, playing: false } : state;
    case "pause": return { ...state, playing: false };
    case "play": return state.step === 4 ? { ...INITIAL_DEMO, playing: true } : { ...state, playing: true };
    case "replay": return { ...INITIAL_DEMO, playing: true };
  }
}
