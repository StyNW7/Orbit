-- Readiness scores keep one decimal so small, real progress is visible
ALTER TABLE "ReadinessSnapshot" ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;

-- pgvector approximate nearest-neighbour indexes (cosine distance) for hybrid recommendations
CREATE INDEX IF NOT EXISTS "Opportunity_embedding_hnsw" ON "Opportunity" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Book_embedding_hnsw" ON "Book" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "ResearchPaper_embedding_hnsw" ON "ResearchPaper" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Event_embedding_hnsw" ON "Event" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Resource_embedding_hnsw" ON "Resource" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "RoleModel_embedding_hnsw" ON "RoleModel" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "CareerProfile_embedding_hnsw" ON "CareerProfile" USING hnsw (embedding vector_cosine_ops);
