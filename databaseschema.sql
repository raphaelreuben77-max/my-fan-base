CREATE TABLE IF NOT EXISTS users(
 id BIGSERIAL PRIMARY KEY,name VARCHAR(30) NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,password_hash TEXT NOT NULL,
 bio VARCHAR(160) DEFAULT '',role VARCHAR(20) NOT NULL DEFAULT 'member',email_verified BOOLEAN NOT NULL DEFAULT FALSE,
 verification_token TEXT,verification_expires TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS posts(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title VARCHAR(80) NOT NULL,body VARCHAR(1000) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'published',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS post_likes(post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS comments(id BIGSERIAL PRIMARY KEY,post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,body VARCHAR(500) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'published',created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS follows(follower_id BIGINT REFERENCES users(id) ON DELETE CASCADE,following_id BIGINT REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(follower_id,following_id));
CREATE TABLE IF NOT EXISTS notifications(id BIGSERIAL PRIMARY KEY,user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,type VARCHAR(30) NOT NULL,message VARCHAR(500) NOT NULL,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS reports(id BIGSERIAL PRIMARY KEY,post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,reporter_id BIGINT REFERENCES users(id) ON DELETE CASCADE,reason VARCHAR(300) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'open',created_at TIMESTAMPTZ DEFAULT NOW(),resolved_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
-- After registering and verifying your own account, promote it:
-- UPDATE users SET role='admin' WHERE email='your-email@example.com';
-- v9 membership layer
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 55000, currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','cancelled','refunded')),
  provider VARCHAR(30) NOT NULL DEFAULT 'manual', provider_reference VARCHAR(255),
  purchased_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_provider_reference_uq ON memberships(provider,provider_reference) WHERE provider_reference IS NOT NULL;
CREATE TABLE IF NOT EXISTS top_fan_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL, card_number VARCHAR(40) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS show_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), membership_id UUID NOT NULL UNIQUE REFERENCES memberships(id) ON DELETE CASCADE,
  total_uses INTEGER NOT NULL DEFAULT 2, used_count INTEGER NOT NULL DEFAULT 0, notes TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meet_greet_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE, requested_show VARCHAR(255), requested_city VARCHAR(255),
  requested_date DATE, message TEXT, status VARCHAR(30) NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','approved','declined','completed','cancelled')),
  admin_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS private_channel_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE, whatsapp_url TEXT, signal_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  approved_at TIMESTAMPTZ, approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider VARCHAR(30) NOT NULL, event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(255), payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
