import { NextResponse } from 'next/server';
import { redisPing } from '@/src/lib/redis';

export const runtime = 'nodejs';

export async function GET() {
  const status = await redisPing();
  return NextResponse.json({
    service: 'redis-cache',
    ...status,
    checkedAt: new Date().toISOString(),
  }, { status: status.connected ? 200 : 503 });
}
