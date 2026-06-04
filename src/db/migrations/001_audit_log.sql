-- Audit log table
-- Stores every single change that happens in watched tables
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      VARCHAR(100) NOT NULL,
    operation       VARCHAR(10)  NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data        JSONB,
    new_data        JSONB,
    lsn             VARCHAR(50)  NOT NULL,
    changed_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name   ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation    ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at   ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_lsn          ON audit_log(lsn);