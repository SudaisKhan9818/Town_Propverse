-- Enable pgvector
create extension if not exists vector;

-- Create table for RAG
create table if not exists town_docs (
  id text primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null,
  created_at timestamp with time zone default now()
);

-- Create index for fast similarity search
create index if not exists town_docs_embedding_idx 
on town_docs using ivfflat (embedding vector_cosine_ops) 
with (lists = 100);

-- Function to search
create or replace function match_town_docs(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    town_docs.id,
    town_docs.content,
    town_docs.metadata,
    1 - (town_docs.embedding <=> query_embedding) as similarity
  from town_docs
  where 1 - (town_docs.embedding <=> query_embedding) > match_threshold
  order by town_docs.embedding <=> query_embedding
  limit match_count;
$$;