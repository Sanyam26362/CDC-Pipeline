-- Webhook subscriptions table
-- Stores which URLs to notify when certain tables change
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              SERIAL PRIMARY KEY,
    url             TEXT         NOT NULL,
    table_name      VARCHAR(100) NOT NULL,
    events          TEXT[]       NOT NULL DEFAULT ARRAY['INSERT', 'UPDATE', 'DELETE'],
    secret          VARCHAR(255) NOT NULL,
    active          BOOLEAN      DEFAULT true,
    created_at      TIMESTAMP    DEFAULT NOW()
    CONSTRAINT unique_webhook UNIQUE (url, table_name)
);

CREATE INDEX IF NOT EXISTS idx_webhook_table_name ON webhook_subscriptions(table_name);
CREATE INDEX IF NOT EXISTS idx_webhook_active     ON webhook_subscriptions(active);

-- Seed a test webhook subscription (points to a local test endpoint)
INSERT INTO webhook_subscriptions (url, table_name, events, secret)
VALUES (
    'http://localhost:4000/webhook',
    'orders',
    ARRAY['INSERT', 'UPDATE'],
    'testsecret123'
) ON CONFLICT DO NOTHING;