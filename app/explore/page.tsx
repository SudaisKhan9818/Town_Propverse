'use client';

import { useRouter } from 'next/navigation';
import { TownCanvas } from '@/src/features/town';
import { AgentWidget } from '@/src/features/rag';

export default function ExplorePage() {
  const router = useRouter();

  return (
    <main style={{ width: '100vw', height: '100vh', backgroundColor: '#F2EADC' }}>
      <TownCanvas visible onClose={() => router.push('/')} />
      <AgentWidget />
    </main>
  );
}
