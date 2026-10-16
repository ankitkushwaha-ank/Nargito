-- Full-text search indexes (expression indexes matching the queries in src/server/services/search.ts)
CREATE INDEX IF NOT EXISTS users_fts_idx ON users USING GIN (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(username,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(bio,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS posts_fts_idx ON posts USING GIN (to_tsvector('simple', coalesce(body,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS companies_fts_idx ON companies USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(tagline,'') || ' ' || coalesce(description,'') || ' ' || coalesce(industry,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shops_fts_idx ON shops USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_fts_idx ON products USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS services_fts_idx ON services USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS trips_fts_idx ON trips USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(destination,'')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS groups_fts_idx ON groups USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));
