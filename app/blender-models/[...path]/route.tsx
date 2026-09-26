import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const MODEL_ROOT = path.join(process.cwd(), 'components', 'town', 'Models');
const DRACO_MODEL_ROOT = path.join(process.cwd(), 'public', 'models-draco');
const RUNTIME_MODEL_ROOT = path.join(process.cwd(), 'public', 'models-runtime');

// Map safe web names to the exact Blender filenames. This avoids stale
// generated copies while keeping the source GLBs untouched.
const MODEL_FILES: Record<string, string> = {
  '5Marla.glb': '5Marla.glb',
  '7Marla.glb': '7 Marla.glb',
  '12Marla.glb': '12Marla.glb',
  'Masjid.glb': 'Masjid.glb',
  'market.glb': 'market.glb',
  'Hospital.glb': 'Hospital.glb',
  'School.glb': 'School.glb',
  'PoliceStation.glb': 'PoliceStation.glb',
  'FireStation.glb': 'FireStation.glb',
  'Wapda.glb': 'Wapda.glb',
  'GreenGround.glb': 'GreenGround.glb',
  'Playground.glb': 'Playground.glb',
};

const RUNTIME_FILES: Record<string, string> = {
  '5Marla.glb': '5Marla.glb',
  '7Marla.glb': '7Marla.glb',
  '12Marla.glb': '12Marla.glb',
  'Masjid.glb': 'Masjid.glb',
  'market.glb': 'market.glb',
  'Hospital.glb': 'Hospital.glb',
  'School.glb': 'School.glb',
  'PoliceStation.glb': 'PoliceStation.glb',
  'FireStation.glb': 'FireStation.glb',
  'Wapda.glb': 'Wapda.glb',
  'GreenGround.glb': 'GreenGround.glb',
  'Playground.glb': 'Playground.glb',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const rawPath = (await params).path;
  const segments = Array.isArray(rawPath) ? rawPath : [rawPath];
  const requested = segments.length === 1 ? decodeURIComponent(segments[0] ?? '') : '';
  const sourceName = MODEL_FILES[requested];

  if (!sourceName) return new Response('Model not found', { status: 404 });

  try {
    const runtimeName = RUNTIME_FILES[requested];
    const runtimePath = runtimeName ? path.resolve(RUNTIME_MODEL_ROOT, runtimeName) : null;
    let filePath = path.resolve(MODEL_ROOT, sourceName);
    const dracoPath = runtimeName ? path.resolve(DRACO_MODEL_ROOT, runtimeName) : null;
    if (runtimePath) {
      try {
        if (dracoPath) {
          await access(dracoPath);
          filePath = dracoPath;
        } else {
          await access(runtimePath);
          filePath = runtimePath;
        }
      } catch {
        try {
          await access(runtimePath);
          filePath = runtimePath;
        } catch {
          // Fall back to the fresh Blender source when no runtime copy exists.
        }
      }
    }
    const bytes = await readFile(/* turbopackIgnore: true */ filePath);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        // Cache is safe because TownScene increments ?v= whenever an export
        // changes. This avoids repeatedly transferring large source GLBs.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Model unavailable', { status: 404 });
  }
}
