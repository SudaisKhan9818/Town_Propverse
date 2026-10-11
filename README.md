# Town Propverse - 3D Digital Twin Town

**Live Demo:** https://town-propverse.vercel.app  
### Tech Stack
- Frontend: Next.js,Three.js, Drie, Raycasting
- 3D Assets: Blender (Custom GLB Models)
- Backend & Realtime: Supabase, Edge Computing ,  MQTT sensor data REaltime for IoT
- AI: LangChain, RAG Pipeline, Redis
- DevOps: Docker

### Overview
Town Propverse is a 3D Digital Twin platform for real estate. It creates a live digital replica of a physical town, connected to real-time IoT data and managed by an AI agent.
It is built to solve visibility and risk issues for builders and societies in Pakistan and the GCC.

### Aim
To build a Smart City system where owners can monitor, predict, and manage a complete town before construction is finished.

### Key Features
- **3D Digital Twin:** 60 plots (5, 7, 12 Marla) rendered with custom Blender GLBs, roads, and amenities
- **Real-time IoT Layer:** Live data streaming via MQTT for lights, water, and security gates
- **Risk Minimizer Engine:** Detects anomalies and potential failures from IoT data
- **RAG AI Agent:** Conversational agent that answers questions based on live town data and documents


### How to Run
```bash
npm install
npm run dev
