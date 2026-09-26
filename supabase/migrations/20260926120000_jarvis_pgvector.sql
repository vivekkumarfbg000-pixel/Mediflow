-- Phase 2: Vectorized "Global Brain" AST (J.A.R.V.I.S. v6.0)
-- This migration enables pgvector and creates the codebase semantic memory table.

-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create the Global Brain AST table to store codebase embeddings
CREATE TABLE IF NOT EXISTS public.jarvis_code_embeddings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path text NOT NULL,
    symbol_name text NOT NULL,
    feature_group text,
    code_content text NOT NULL,
    embedding vector(768), -- Google Gemini / Nomic Embeddings (768 dimensions)
    updated_at timestamp with time zone DEFAULT now()
);

-- Index for blazing fast vector similarity search (HNSW)
CREATE INDEX IF NOT EXISTS idx_jarvis_code_embeddings_embedding 
ON public.jarvis_code_embeddings USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.jarvis_code_embeddings ENABLE ROW LEVEL SECURITY;

-- Autonomous Daemon Bridge requires read/write access
CREATE POLICY "Allow Jarvis Daemon Full Access" 
ON public.jarvis_code_embeddings 
FOR ALL USING (true);
-- Trigger CI
