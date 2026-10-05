import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

process.loadEnvFile(path.join(process.cwd(), '.env.local'));

type TownChunk = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
};

const root = process.cwd();
const embeddingModel = 'gemini-embedding-2';
const batchSize = 20;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local before running npm run embed:gemini.`);
  return value;
}

async function main() {
  const { supabaseAdmin } = await import('../src/lib/supabaseClient');
  const ai = new GoogleGenAI({ apiKey: requiredEnv('GOOGLE_GEMINI_API_KEY') });
  const chunks = JSON.parse(
    await readFile(path.join(root, 'scripts', 'propverse_town_chunks.json'), 'utf8'),
  ) as TownChunk[];
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error('town_chunks.json is empty or invalid.');

  let uploaded = 0;
  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const embeddings = [] as number[][];
    for (const chunk of batch) {
      const response = await ai.models.embedContent({
        model: embeddingModel,
        contents: chunk.content,
        config: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' },
      });
      const values = response.embeddings?.[0]?.values ?? [];
      if (values.length !== 768) throw new Error(`Expected a 768-dimension embedding for ${chunk.id}.`);
      embeddings.push(values);
    }

    const rows = batch.map((chunk, index) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: `[${embeddings[index].join(',')}]`,
      metadata: chunk.metadata,
    }));
    const { error } = await supabaseAdmin.from('town_docs').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    uploaded += rows.length;
    console.log(`Uploaded ${uploaded}/${chunks.length} chunks.`);
  }
  console.log(`Embedding upload complete: ${uploaded} town documents.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
