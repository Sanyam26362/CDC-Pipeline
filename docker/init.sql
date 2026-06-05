-- Create test tables to simulate a real application
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
SELECT pg_create_logical_replication_slot('cdc_pipeline_slot', 'wal2json')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_replication_slots WHERE slot_name = 'cdc_pipeline_slot'
);

-- Insert some seed data
INSERT INTO users (name, email) VALUES
    ('Sanyam Agarwal', 'sanyam@example.com'),
    ('Samriddhi Mishra', 'samriddhi@example.com'),
    ('Krishna', 'krishna@example.com');

INSERT INTO products (name, price, stock) VALUES
    ('Laptop', 75000.00, 10),
    ('Phone', 25000.00, 25),
    ('Headphones', 3000.00, 50);