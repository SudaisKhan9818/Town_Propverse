import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '@/src/lib/supabaseClient';
import { redisGet, redisSet } from '@/src/lib/redis';

export const runtime = 'nodejs';

type HistoryItem = { role?: string; text?: string };
type Match = { id: string; content: string; metadata: Record<string, unknown>; similarity: number };
type AskResponse = {
  answer: string;
  sources: Array<{ id: string; metadata: Record<string, unknown>; similarity: number }>;
  action: { type: string; target: unknown; position: unknown };
};

const townAgentInstructions = [
  'You are PropVerse TownAgent, the official AI guide for PropVerse Town.',
  'PropVerse Town is owned and developed by Sudais Khan, founder and owner.',
  'The developer is Sudai / Sudais Khan Properties.',
  'The town includes 5 to 12 Marla double-storey bungalows, shops, mosques, a school, a park, and civic facilities including a police station on Civic Road.',
  'Current public inventory counts are: 25 houses, 75 streetlight poles, 6 roads, 2 markets, 2 masjids, 1 school, 1 hospital, 1 park, 1 grid station, 1 police station, 1 fire station, and 8 boundary wall runs.',
  'All 25 current property chunks are for sale; none is listed as a rental property. A house with occupied or rented status is not available for rent.',
  'If asked who owns the town, answer that PropVerse Town is owned and developed by Sudais Khan, founder of the town.',
  'Never reveal any private owner contact, phone number, CNIC, or address; direct contact requests to the booking office on Main Boulevard.',
  'For house specifications, use only the supplied public context and never invent size, status, bedrooms, street, or facing details.',
  'When listing houses, include their entity IDs. Do not ask the interface to focus an entity unless the user explicitly asks to show, locate, focus, or navigate to it.',
  'Answer general questions and greetings helpfully even when the retrieved context is empty.',
  'For questions about the number of houses, say approximately 25 bungalows are listed, plus civic amenities.',
  'For mosque, school, or police questions, use the supplied context; the police station is on Civic Road and has a 24-hour FIR desk when supported by context.',
  'Match the user language, including Urdu, Hinglish, or Pashto. Keep replies short and friendly.',
].join(' ');

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function wantsFocus(question: string): boolean {
  return /\b(show me|show it|show this|where is|where's|locate|focus on|focus the|take me to|go to|navigate to|point me to|bring me to)\b/i.test(question);
}

function makeCacheKey(question: string, history: unknown) {
  const recentHistory = Array.isArray(history)
    ? history.slice(-4).map((item) => {
      const value = item as HistoryItem;
      return { role: value.role, text: value.text };
    })
    : [];
  const digest = createHash('sha256')
    .update(JSON.stringify({ question: question.toLowerCase(), history: recentHistory }))
    .digest('hex');
  return `propverse:rag:v2:${digest}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { question?: unknown; message?: unknown; history?: unknown };
    const question = typeof body.question === 'string' ? body.question.trim()
      : typeof body.message === 'string' ? body.message.trim() : '';
    if (!question || question.length > 2000) {
      return NextResponse.json({ error: 'Send a question between 1 and 2000 characters.' }, { status: 400 });
    }

    const cacheKey = makeCacheKey(question, body.history);
    const cached = await redisGet<AskResponse>(cacheKey);
    if (cached) return NextResponse.json({ ...cached, cache: 'hit' });
    const cacheResponse = async (payload: AskResponse) => {
      await redisSet(cacheKey, payload, 300);
      return NextResponse.json({ ...payload, cache: 'miss' });
    };

    const ai = new GoogleGenAI({ apiKey: env('GOOGLE_GEMINI_API_KEY') });
    const embedding = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: question,
      config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
    });
    const queryVector = embedding.embeddings?.[0]?.values ?? [];
    if (queryVector.length !== 768) throw new Error('Gemini returned an invalid query embedding dimension.');
    const { data, error } = await supabaseAdmin.rpc('match_town_docs', {
      query_embedding: `[${queryVector.join(',')}]`,
      match_threshold: 0.2,
      match_count: 8,
    });
    if (error) throw new Error(`Supabase search failed: ${error.message}`);

    const matches = (data ?? []) as Match[];
    const focusRequested = wantsFocus(question);
    const focusAction = focusRequested && matches.length > 0
      ? {
        type: 'FOCUS',
        target: matches[0]?.metadata.focusTarget ?? matches[0]?.id ?? null,
        position: matches[0]?.metadata.position ?? null,
      }
      : { type: 'FOCUS', target: null, position: null };

    const normalizedQuestion = question.toLowerCase();
    const asksOwner = /\b(owner|owns|malik|maalik|founder|developer)\b/.test(normalizedQuestion)
      && /\b(town|propverse|society|shehar|shahar)\b/.test(normalizedQuestion);
    const asksPrivateContact = /\b(phone|number|cnic|address|contact|rabta|mobile)\b/.test(normalizedQuestion);
    const asksIfWorking = /\b(is ai working|are you working|are you ai|working ho|kaam kar)\b/.test(normalizedQuestion);
    const asksAboutTown = /\b(what is propverse|what is this town|propverse kya|town kya)\b/.test(normalizedQuestion);
    const asksHouseCount = /\b(how many houses|total plots|kitne ghar|total houses)\b/.test(normalizedQuestion);
    const asksLightCount = /\b(how many|how much|total|count|kitne|kitni)\b/.test(normalizedQuestion)
      && /\b(light|lights|streetlight|streetlights|poles|pole)\b/.test(normalizedQuestion);
    const asksTownInventory = /\b(total|all|inventory|everything|kitna|kitni|kitne)\b/.test(normalizedQuestion)
      && /\b(town|shehar|shahar|here|yahan)\b/.test(normalizedQuestion);
    const asksRent = /\b(rent|rental|kiraya|kiraye|to rent)\b/.test(normalizedQuestion);
    const isGreeting = /^(hey|hello|hi|salam|assalamualaikum|aoa)\b/.test(normalizedQuestion);
    const asksCivicPlace = /\b(where|kahan|mosque|masjid|school|police|hospital|park)\b/.test(normalizedQuestion);

    let directAnswer: string | null = null;
    if (asksOwner && asksPrivateContact) {
      directAnswer = 'For owner contact, please visit the booking office on Main Boulevard.';
    } else if (asksOwner) {
      directAnswer = 'PropVerse Town is owned and developed by Sudais Khan. He is the founder of this town.';
    } else if (asksIfWorking) {
      directAnswer = "Yes! I'm TownAgent, your PropVerse guide powered by Gemini. I can help you find houses, shops, and civic places in PropVerse Town, owned by Sudais Khan.";
    } else if (asksAboutTown) {
      directAnswer = 'PropVerse Town is a modern housing society owned by Sudais Khan, with 5 to 12 Marla bungalows, security, mosques, a school, parks, and civic facilities.';
    } else if (asksHouseCount) {
      directAnswer = 'Approximately 25 bungalows are listed in PropVerse Town, along with civic amenities.';
    } else if (asksLightCount) {
      directAnswer = 'PropVerse Town has 75 registered streetlight poles across the main and internal road network.';
    } else if (asksTownInventory) {
      directAnswer = 'PropVerse Town currently has 25 houses, 75 streetlight poles, 6 roads, 2 markets, 2 masjids, 1 school, 1 hospital, 1 park, 1 grid station, 1 police station, 1 fire station, and 8 boundary wall runs.';
    } else if (asksRent) {
      directAnswer = 'The current public property inventory lists houses for sale, not for rent. No 5 Marla or 7 Marla house is currently listed as available for rent.';
    } else if (isGreeting) {
      directAnswer = "Walaikum Salam! I'm TownAgent for Sudais Khan's PropVerse Town. How can I help you find a house?";
    } else if (asksCivicPlace && matches.length === 0) {
      directAnswer = 'PropVerse Town includes mosques, a school, parks, and a police station on Civic Road with a 24-hour FIR desk.';
    }

    if (directAnswer) {
      return cacheResponse({
        answer: directAnswer,
        sources: matches.map(({ id, metadata, similarity }) => ({ id, metadata, similarity })),
        action: focusAction,
      });
    }

    if (matches.length === 0) {
      return cacheResponse({
        answer: 'I could not find that information in PropVerse Town.',
        sources: [],
        action: { type: 'FOCUS', target: null, position: null },
      });
    }

    const history = Array.isArray(body.history)
      ? (body.history as HistoryItem[])
        .filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
        .slice(-8)
        .map((item) => `${item.role}: ${item.text}`)
        .join('\n')
      : '';
    const context = matches.map((match) => `[${match.id}] ${match.content}`).join('\n');
    const prompt = [
        townAgentInstructions,
      ].join(' ')
      + `\n\n${history ? `Recent conversation:\n${history}\n\n` : ''}Public town context:\n${context}\n\nQuestion: ${question}`;
    let response;
    try {
      response = await ai.models.generateContent({ model: 'gemini-3.5-flash-lite', contents: prompt });
    } catch (primaryError) {
      console.warn('Primary Gemini chat model failed; trying fallback model.');
      response = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: prompt });
    }

    return cacheResponse({
      answer: response.text?.trim() || 'I could not generate an answer from the public town data.',
      sources: matches.map(({ id, metadata, similarity }) => ({ id, metadata, similarity })),
      action: focusAction,
    });
  } catch (error: unknown) {
    console.error('RAG ask error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'The Town Agent is temporarily unavailable.' }, { status: 500 });
  }
}
