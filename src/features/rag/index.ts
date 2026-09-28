// Public API of the Town Agent (RAG) UI. Backend is connected by the host
// app via setAgentHandler(); see store/agent-store.ts.

export { default as AgentWidget } from './ui/AgentWidget';
export { setAgentHandler, useAgentStore } from './store/agent-store';
export type { AgentHandler, ChatMessage, TwinState } from './store/agent-store';
