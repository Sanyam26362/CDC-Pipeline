# CDC Pipeline — Real-Time Change Data Capture Engine

A production-grade backend service that taps into PostgreSQL's 
Write-Ahead Log (WAL) to stream every database change in real-time 
to multiple downstream systems — without polling.

## What it does
- Captures every INSERT, UPDATE, DELETE from Postgres in real-time
- Fans out changes to Redis cache, audit log, and webhook endpoints
- Crash-safe — resumes from exact position after restart using LSN checkpointing
- At-least-once delivery guarantee with idempotency protection

## Architecture
PostgreSQL WAL → Node.js CDC Service → Redis Cache (auto-sync)
                                     → Audit Log (full history)
                                     → Webhooks (HMAC signed)

## Tech Stack
Node.js, PostgreSQL (logical replication), Redis, 
Docker, Express, wal2json

## Key Concepts Implemented
- Logical replication & replication slots
- LSN (Log Sequence Number) checkpointing
- Event-driven fan-out architecture
- Idempotent consumers
- Exponential backoff retry
- HMAC-SHA256 webhook signing

## Setup
1. Clone the repo
2. Run `docker-compose up -d`
3. Run `npm run migrate`
4. Run `npm run dev`

## API Endpoints
GET  /health          - Service health + metrics
GET  /audit           - Query full change history
POST /replay          - Re-process events from a timestamp