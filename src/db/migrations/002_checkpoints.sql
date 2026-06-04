-- Checkpoints table
-- Stores the last processed WAL position (LSN) so we can resume after crashes
CREATE TABLE IF NOT EXISTS checkpoints (
    slot_name       VARCHAR(100) PRIMARY KEY,
    last_lsn        VARCHAR(50)  NOT NULL,
    events_processed BIGINT      DEFAULT 0,
    updated_at      TIMESTAMP    DEFAULT NOW()
);

-- Seed the initial checkpoint row
INSERT INTO checkpoints (slot_name, last_lsn, events_processed)
VALUES ('cdc_pipeline_slot', '0/0', 0)
ON CONFLICT (slot_name) DO NOTHING;