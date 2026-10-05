import { createClient, type RedisClientType } from 'redis';

type CacheClient = RedisClientType<{}, {}, {}, 2, {}>;

let client: CacheClient | null = null;
let connection: Promise<CacheClient | null> | null = null;
let errorReported = false;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || '';
}

async function getClient(): Promise<CacheClient | null> {
  const url = redisUrl();
  if (!url) return null;
  if (client?.isReady) return client;
  if (connection) return connection;

  const nextClient = createClient({
    url,
    // Redis on Windows 3.x does not implement the RESP3 HELLO command.
    RESP: 2,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: false,
    },
  });
  nextClient.on('error', () => {
    if (!errorReported) {
      errorReported = true;
      console.warn('Redis cache unavailable; continuing without cache.');
    }
  });
  connection = nextClient.connect()
    .then(() => {
      client = nextClient;
      errorReported = false;
      return nextClient;
    })
    .catch(async () => {
      connection = null;
      if (nextClient.isOpen) {
        await nextClient.disconnect().catch(() => undefined);
      }
      return null;
    });
  return connection;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getClient();
    if (!redis) return null;
    const value = await redis.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds = 300): Promise<boolean> {
  try {
    const redis = await getClient();
    if (!redis) return false;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
}

export async function redisPing() {
  try {
    const redis = await getClient();
    if (!redis) return { configured: false, connected: false, response: null };
    const response = await redis.ping();
    return { configured: true, connected: true, response };
  } catch {
    return { configured: Boolean(redisUrl()), connected: false, response: null };
  }
}
