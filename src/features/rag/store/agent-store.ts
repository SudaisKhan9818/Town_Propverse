// ═══════════════════════════════════════════════════════════════════
// agent-store.ts — state for the Town Agent chat widget (UI only).
//
// CONNECTING YOUR BACKEND (one call, anywhere on the client):
//
//   import { setAgentHandler } from '@/src/features/rag';
//   setAgentHandler(async (message, history) => {
//     const res = await fetch('/api/agent', { method: 'POST', body: JSON.stringify({ message, history }) });
//     return (await res.json()).answer;          // string (markdown-free text)
//   });
//
// Until a handler is set the widget shows "Offline" and tells the user the
// backend is not connected — it never invents answers.
//
// DIGITAL TWIN (reserved): push live readings with
//   useAgentStore.getState().setTwin({ gridTemp: 41.2, lightEnergy: 18.4, fireAlert: false });
// null = no feed yet ("—" in the UI).
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

export type AgentHandler = (message: string, history: ChatMessage[]) => Promise<string>;

export interface TwinState {
  /** Grid-station transformer temperature, °C. */
  gridTemp: number | null;
  /** Streetlight network draw, kWh today. */
  lightEnergy: number | null;
  /** Any active fire alert in town. */
  fireAlert: boolean | null;
}

interface AgentState {
  messages: ChatMessage[];
  pending: boolean;
  handler: AgentHandler | null;
  /** True while a twin/telemetry feed is pushing readings. */
  monitoring: boolean;
  twin: TwinState;
  send: (text: string) => Promise<void>;
  clear: () => void;
  setHandler: (handler: AgentHandler | null) => void;
  setTwin: (twin: Partial<TwinState>) => void;
  setMonitoring: (monitoring: boolean) => void;
}

let seq = 0;
const message = (role: ChatRole, text: string): ChatMessage => ({ id: `m${Date.now()}-${seq += 1}`, role, text, at: Date.now() });

export const useAgentStore = create<AgentState>()((set, get) => ({
  messages: [],
  pending: false,
  handler: null,
  monitoring: false,
  twin: { gridTemp: null, lightEnergy: null, fireAlert: null },

  send: async (raw) => {
    const text = raw.trim();
    if (!text || get().pending) return;
    const history = get().messages;
    set({ messages: [...history, message('user', text)] });
    const { handler } = get();
    if (!handler) {
      set((s) => ({ messages: [...s.messages, message('system', 'The agent backend isn’t connected yet — your question is saved here.')] }));
      return;
    }
    set({ pending: true });
    try {
      const answer = await handler(text, history);
      set((s) => ({ messages: [...s.messages, message('assistant', answer)] }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      set((s) => ({ messages: [...s.messages, message('system', `Couldn’t reach the agent (${reason}). Try again.`)] }));
    } finally {
      set({ pending: false });
    }
  },
  clear: () => set({ messages: [] }),
  setHandler: (handler) => set({ handler }),
  setTwin: (twin) => set((s) => ({ twin: { ...s.twin, ...twin } })),
  setMonitoring: (monitoring) => set({ monitoring }),
}));

/** Public: connect (or disconnect with null) the RAG backend. */
export const setAgentHandler = (handler: AgentHandler | null) => useAgentStore.getState().setHandler(handler);
