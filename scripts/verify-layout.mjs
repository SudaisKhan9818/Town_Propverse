// verify-layout.mjs — proves RULE ZERO: the frozen town layout is unchanged.
//
//   node scripts/verify-layout.mjs            → compare against the baseline
//   node scripts/verify-layout.mjs --write    → (re)write the baseline snapshot
//
// Compiles src/features/town/data/{town.config,layout-engine}.ts with the
// TypeScript compiler, runs generateTownLayout() and diffs every plot, road,
// amenity and civic block against docs/qa/layout-baseline.json.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = path.join(root, 'src/features/town/data');
const baselinePath = path.join(root, 'docs/qa/layout-baseline.json');

async function loadLayout() {
  const dir = await mkdtemp(path.join(tmpdir(), 'propverse-layout-'));
  for (const name of ['town.config', 'layout-engine']) {
    const source = await readFile(path.join(dataDir, `${name}.ts`), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    await writeFile(path.join(dir, `${name}.mjs`), outputText.replace(/from '\.\/town\.config'/g, "from './town.config.mjs'"));
  }
  const engine = await import(pathToFileURL(path.join(dir, 'layout-engine.mjs')).href);
  const town = engine.generateTownLayout();
  await rm(dir, { recursive: true, force: true });
  // Only the frozen geometry: ids, positions, bounds, road network.
  return {
    streets: town.streets.map(({ id, position, width, length, orientation }) => ({ id, position, width, length, orientation })),
    plots: town.plots.map(({ id, size, position, bounds, side, streetId }) => ({ id, size, position, bounds, side, streetId })),
    amenities: town.amenities.map(({ id, type, position, bounds }) => ({ id, type, position, bounds })),
    civic: town.civic.map(({ id, type, position, bounds }) => ({ id, type, position, bounds })),
    greenBelts: town.greenBelts,
    trees: town.trees,
  };
}

const layout = await loadLayout();
if (process.argv.includes('--write')) {
  await writeFile(baselinePath, `${JSON.stringify(layout, null, 1)}\n`);
  console.log(`Baseline written: ${layout.plots.length} plots, ${layout.streets.length} roads, ${layout.amenities.length} amenities, ${layout.civic.length} civic blocks`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const diffs = [];
for (const key of Object.keys(baseline)) {
  const a = baseline[key];
  const b = layout[key];
  if (a.length !== b.length) diffs.push(`${key}: count ${a.length} → ${b.length}`);
  a.forEach((item, i) => {
    if (JSON.stringify(item) !== JSON.stringify(b[i])) diffs.push(`${key}[${i}] ${item.id ?? ''}: ${JSON.stringify(item)} → ${JSON.stringify(b[i])}`);
  });
}
if (diffs.length) {
  console.error(`LAYOUT DIFF: FAIL (${diffs.length} changes)\n${diffs.join('\n')}`);
  process.exit(1);
}
console.log(`LAYOUT DIFF: PASS — ${layout.plots.length} plots, ${layout.streets.length} roads, ${layout.amenities.length} amenities, ${layout.civic.length} civic blocks, ${layout.trees.length} trees: zero position changes`);
