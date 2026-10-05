-- Gemini embedding vectors are stored at the 768-dimensional setting.
-- Existing embeddings are cleared and must be regenerated with npm run embed:gemini.
drop function if exists match_town_docs(vector, float, int);
drop index if exists town_docs_embedding_idx;

alter table town_docs
  alter column embedding type vector(768)
  using null;

create index town_docs_embedding_idx
  on town_docs using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_town_docs(
  query_embedding vector(768),
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
