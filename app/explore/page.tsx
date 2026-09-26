'use client';

import TownCanvas from '@/components/town/TownCanvas';
import { useRouter } from 'next/navigation';

export default function ExplorePage() {
  const router = useRouter();

  return (
    <main style={{ width: '100vw', height: '100vh', backgroundColor: '#FFF1E0' }}>
      <TownCanvas visible={true} onClose={() => router.push('/')} />
    </main>
  );
}
