# Dice API — Architecture Overview

A workshop demonstration of AWS services working together via a simple dice-rolling API.

## Services Used

| Service | Purpose |
|---------|---------|
| API Gateway (HTTP API v2) | Request routing, CORS, custom authoriser |
| Lambda (Node.js 24, ARM64) | Compute for all handlers |
| DynamoDB | Single-table storage for rolls and stats |
| DynamoDB Streams | Event source for stream processor (disabled by default) |
| SNS | Fan-out topic for roll events |
| SQS + DLQ | Buffered delivery to stats processor with retry |
| Secrets Manager | API key storage for the authoriser |
| CloudWatch Alarms | Operational monitoring |
| S3 + DynamoDB | Terraform state backend |

## Data Flow

1. Client calls `POST /roll`
2. Roll Lambda writes a roll record to DynamoDB and publishes to SNS
3. SNS delivers the message to the stats SQS queue
4. Stats Processor Lambda consumes from SQS and incrementally updates the `STATS` item
5. Client calls `GET /stats` to read the latest aggregated stats

### Alternative Flow (DynamoDB Streams)

When `enable_stream_processor = true`:
1. Roll Lambda writes to DynamoDB (but does NOT publish to SNS)
2. DynamoDB Stream triggers the Stream Processor Lambda
3. Stream Processor publishes to the same SNS topic
4. Flow continues from step 3 above

**Important:** Only one path should be active at a time to avoid double-counting.

## Key Design Decisions

- **Single-table DynamoDB** — rolls use `PK = ROLL#<uuid>`, stats use `PK = STATS`
- **Incremental stats** — count/sum via `ADD`, min/max via conditional updates (separate operations)
- **At-least-once delivery** — SQS/Lambda is at-least-once; stats may slightly overcount under rare duplicate delivery
- **Mutual exclusivity** — Terraform validates that direct publish and stream processor cannot both be enabled

## Architecture Diagrams

See [C4 Container Diagram](./c4-container.md) for the full system view.

## Infrastructure

- **IaC:** Terraform modules + Terragrunt
- **State:** S3 bucket `terragrunt-state-for-dice-api-<user>` in eu-west-2 (where `<user>` comes from the `AWS_SANDBOX_ACCOUNT_USER` env var)
- **Module:** Single module at `infrastructure/modules/dice-api/`
- **Environment:** Sandbox only (`infrastructure/sandbox/eu-west-2/dice-api/`)
