# AWS Overview — Beginner's Guide

This guide is for engineers who are new to AWS. It explains the services used in this project, key terminology, and how everything connects together.

---

## AWS Services Used

### Lambda

**What it is:** A "serverless" compute service. You give AWS a zip file containing your code (a "handler function"), and AWS runs it whenever something triggers it — an HTTP request, a message from a queue, a database change, etc.

**Why it matters:** You don't manage servers. AWS handles scaling, patching, and availability. You only pay for the milliseconds your code runs.

**In this project:** We have 6 Lambda functions — one for each API endpoint, one authoriser, one SQS processor, and one DynamoDB Stream processor.

---

### API Gateway (HTTP API v2)

**What it is:** A managed HTTPS endpoint that routes incoming HTTP requests to backend services (usually Lambda). Think of it as a reverse proxy/router that AWS manages for you.

**Why it matters:** It gives your Lambdas a public URL, handles CORS, rate limiting, and can attach authorisers to specific routes.

**In this project:** API Gateway exposes three routes (`POST /roll`, `GET /stats`, `DELETE /reset`) and routes each to its respective Lambda function. The `DELETE /reset` route has a custom authoriser attached.

---

### DynamoDB

**What it is:** A fully managed NoSQL key-value/document database. You define a table with a primary key (called a "partition key"), and read/write individual items using that key.

**Why it matters:** It's fast (single-digit millisecond reads), scales automatically, and charges per-request — ideal for serverless architectures.

**In this project:** One table (`dice-api-rolls`) stores both individual roll records and the aggregated stats:

| pk (Partition Key) | Type | Other attributes |
|---|---|---|
| `ROLL#abc-123` | Individual dice roll | `rollId`, `result`, `timestamp` |
| `STATS` | Aggregated statistics | `count`, `sum`, `min`, `max` |

This is called "single-table design" — using one table for multiple entity types, distinguished by the key pattern.

---

### DynamoDB Streams

**What it is:** An ordered log of changes to a DynamoDB table. Every time an item is created, updated, or deleted, the change is recorded in the stream. You can attach a Lambda to process these changes.

**Why it matters:** It enables event-driven architectures — reacting to data changes rather than polling. It guarantees ordering within each partition key.

**In this project:** The stream captures new roll items and triggers the stream-processor Lambda (disabled by default — a workshop toggle).

---

### SNS (Simple Notification Service)

**What it is:** A publish/subscribe messaging service. You publish a message to a "topic", and all subscribers receive it. Subscribers can be SQS queues, Lambda functions, email addresses, HTTP endpoints, etc.

**Why it matters:** It decouples producers from consumers. The roll Lambda doesn't need to know who processes its events — it just publishes and moves on. You can add more subscribers later without changing the publisher.

**In this project:** The SNS topic `dice-api-roll-events` receives roll event messages. The stats SQS queue is subscribed to this topic.

---

### SQS (Simple Queue Service)

**What it is:** A managed message queue. Messages are stored durably until a consumer processes them. If processing fails, the message becomes visible again for retry.

**Why it matters:** It buffers work between services, handles retries automatically, and prevents message loss. If the stats processor is slow or failing, messages wait safely in the queue.

**In this project:** The stats queue receives messages from SNS and triggers the stats-processor Lambda in batches.

---

### Dead Letter Queue (DLQ)

**What it is:** A separate SQS queue where messages go after failing processing multiple times (configurable — we use 3 retries). It prevents "poison messages" from blocking the main queue forever.

**Why it matters:** Without a DLQ, a bad message would be retried indefinitely, blocking all other messages behind it. The DLQ captures failures for investigation.

**In this project:** Two DLQs exist:
- `dice-api-stats-queue-dlq` — for failed SQS messages (stats processing failures)
- `dice-api-stream-dlq` — for failed DynamoDB Stream records

---

### Secrets Manager

**What it is:** A secure store for sensitive values (API keys, database passwords, tokens). Applications read secrets at runtime via the AWS SDK rather than hardcoding them.

**Why it matters:** Secrets never appear in source code or environment variable configuration files. They can be rotated without redeploying. Access is controlled by IAM policies.

**In this project:** The API key for the reset endpoint is stored in Secrets Manager. The authoriser Lambda reads it at runtime and caches it in memory.

---

### CloudWatch

**What it is:** AWS's monitoring and observability service. It collects logs, metrics, and can trigger alarms when thresholds are breached.

**Why it matters:** It's how you know if your services are healthy. Lambda automatically sends logs and metrics (invocations, errors, duration) to CloudWatch.

**In this project:** We define 5 types of alarms:
- **Lambda Errors** — any function throwing unhandled exceptions
- **API Gateway 5xx** — server errors returned to clients
- **SQS Message Age** — messages waiting too long to be processed
- **DLQ Depth** — messages landing in the dead letter queue
- **Lambda Duration** — functions approaching their timeout

---

### IAM (Identity and Access Management)

**What it is:** AWS's permission system. Every service and resource has an IAM policy defining what it can access. Lambda functions get an "execution role" with specific permissions.

**Why it matters:** Without explicit permission, a Lambda cannot read from DynamoDB, publish to SNS, or do anything at all. This is the principle of least privilege.

**In this project:** Each Lambda has a minimal policy. For example, the roll Lambda can only `PutItem` to DynamoDB and `Publish` to SNS — it cannot delete items or read secrets.

---

### Terraform & Terragrunt

**What it is:**
- **Terraform** — Infrastructure as Code (IaC). You describe what AWS resources you want in `.tf` files, and Terraform creates/updates/deletes them to match.
- **Terragrunt** — A wrapper around Terraform that handles shared configuration, remote state, and environment separation.

**Why it matters:** Infrastructure is versioned, reviewable, and repeatable. Running `terragrunt apply` creates everything consistently — no clicking through the AWS console.

**In this project:**
- `infrastructure/modules/dice-api/` — the Terraform module (what to create)
- `infrastructure/sandbox/eu-west-2/dice-api/terragrunt.hcl` — the environment config (where and with what settings)
- `infrastructure/root.hcl` — shared provider/state config

---

## Glossary

| Term | Meaning |
|------|---------|
| **ARN** | Amazon Resource Name — a unique identifier for any AWS resource, e.g. `arn:aws:lambda:eu-west-2:123456789:function:dice-api-roll` |
| **Cold start** | The first invocation of a Lambda in a new execution environment. AWS must download your code and initialise the runtime (~100-500ms overhead) |
| **Warm start** | Subsequent invocations that reuse an existing execution environment. Module-level variables (like SDK clients) persist |
| **Event source mapping** | A Lambda configuration that polls a source (SQS, DynamoDB Streams, Kinesis) and invokes the function with batches of records |
| **Partition key** | The primary key of a DynamoDB table. Determines which partition stores the item and how it's retrieved |
| **Stream** | An ordered log of changes (DynamoDB Streams). Each record contains the old/new state of a changed item |
| **DLQ** | Dead Letter Queue — where failed messages go after exceeding retry attempts |
| **Visibility timeout** | How long SQS hides a message from other consumers while one is processing it. If processing fails before timeout, the message reappears |
| **At-least-once delivery** | SQS guarantees every message is delivered at least once, but may rarely deliver duplicates. Design for idempotency |
| **Eventual consistency** | After a write, reads may not immediately reflect the change. Stats may lag a few seconds behind rolls |
| **Terraform state** | A JSON file (stored in S3) tracking what resources Terraform has created. Used to calculate diffs on the next `apply` |
| **Terraform plan** | A dry-run showing what Terraform will create/modify/destroy. Always review before applying |
| **Terragrunt inputs** | Variables passed from `terragrunt.hcl` into the Terraform module (like function arguments) |

---

## End-to-End Walkthrough: What happens when you call `POST /roll`?

### 1. You run the curl command

```bash
curl -X POST https://ixvk4ixi35.execute-api.eu-west-2.amazonaws.com/roll
```

### 2. API Gateway receives the request

API Gateway matches the route `POST /roll` → no authoriser → invokes `dice-api-roll` Lambda.

### 3. Roll Lambda executes (`src/api/roll.ts`)

```
→ Generates: rollId = "abc-123", result = 4, timestamp = "2026-05-19T10:00:00Z"
→ Writes to DynamoDB:
    { pk: "ROLL#abc-123", rollId: "abc-123", result: 4, timestamp: "2026-05-19T10:00:00Z" }
→ Publishes to SNS:
    { rollId: "abc-123", result: 4, timestamp: "2026-05-19T10:00:00Z" }
→ Returns to client:
    { "rollId": "abc-123", "result": 4, "timestamp": "2026-05-19T10:00:00Z" }
```

### 4. SNS delivers to SQS

SNS wraps the message in an envelope and delivers it to the subscribed SQS queue:

```json
{
    "Type": "Notification",
    "TopicArn": "arn:aws:sns:eu-west-2:...:dice-api-roll-events",
    "Message": "{\"rollId\":\"abc-123\",\"result\":4,\"timestamp\":\"2026-05-19T10:00:00Z\"}",
    "Timestamp": "2026-05-19T10:00:00.100Z"
}
```

### 5. Lambda polls SQS and invokes stats-processor

The event source mapping polls the queue and invokes `dice-api-stats-processor` with a batch:

```json
{
    "Records": [
        {
            "body": "<the SNS envelope JSON from step 4>"
        }
    ]
}
```

### 6. Stats Processor updates DynamoDB (`src/processors/stats-processor.ts`)

Parses: `record.body` → SNS envelope → `.Message` → `{ rollId, result }`.

Calls `updateStats("dice-api-rolls", 4)` which runs three DynamoDB operations:

1. `ADD count 1, sum 4` → count becomes 1, sum becomes 4
2. `SET min = 4` (if no existing min or 4 < current min)
3. `SET max = 4` (if no existing max or 4 > current max)

### 7. You call `GET /stats`

```bash
curl https://ixvk4ixi35.execute-api.eu-west-2.amazonaws.com/stats
# → { "count": 1, "sum": 4, "min": 4, "max": 4, "mean": 4 }
```

The stats Lambda does a simple `GetItem` on `pk = "STATS"` and returns the pre-computed values.

---

## How Code Connects to Infrastructure

Every `process.env.X` in the Lambda code is wired in the corresponding Terraform file:

| Code (`process.env.X`) | Terraform file | Terraform value | What it provides |
|---|---|---|---|
| `TABLE_NAME` | `lambda-roll.tf` | `aws_dynamodb_table.rolls.name` | DynamoDB table name (`dice-api-rolls`) |
| `TOPIC_ARN` | `lambda-roll.tf` | `module.sns_topic.topic_arn` | SNS topic to publish roll events |
| `DIRECT_PUBLISH_ENABLED` | `lambda-roll.tf` | `var.enable_direct_publish` | Workshop toggle for SNS vs Streams |
| `TABLE_NAME` | `lambda-stats.tf` | `aws_dynamodb_table.rolls.name` | Same table, read-only access |
| `TABLE_NAME` | `lambda-reset.tf` | `aws_dynamodb_table.rolls.name` | Same table, scan+delete access |
| `SECRET_NAME` | `lambda-authoriser.tf` | `aws_secretsmanager_secret.api_key.name` | Secret containing the API key |
| `TABLE_NAME` | `lambda-stats-processor.tf` | `aws_dynamodb_table.rolls.name` | Where to write stats updates |
| `TOPIC_ARN` | `lambda-stream-processor.tf` | `module.sns_topic.topic_arn` | Where stream processor publishes |

**IAM permissions** are also defined per-Lambda. For example, `lambda-roll.tf` grants:
- `dynamodb:PutItem` on the rolls table (can write rolls, nothing else)
- `sns:Publish` on the SNS topic (can send messages, nothing else)

Without these permissions, the Lambda would get an `AccessDenied` error at runtime.

---

## Two Event Paths (Workshop Toggle)

| Mode | Setting | Data flow |
|------|---------|-----------|
| **Direct publish** (default) | `enable_direct_publish = true`, `enable_stream_processor = false` | Roll Lambda → SNS → SQS → Stats Processor |
| **Stream mode** (workshop demo) | `enable_direct_publish = false`, `enable_stream_processor = true` | Roll Lambda → DynamoDB → Stream → Stream Processor Lambda → SNS → SQS → Stats Processor |

⚠️ Only one mode should be active. If both are enabled, each roll generates TWO messages to SNS, causing stats to double-count.

The stream is always enabled on the DynamoDB table itself — what's toggled is the Lambda event source mapping (whether Lambda actually reads from the stream).

---

## Deploying to Your Sandbox

### Prerequisites

Install these tools:

| Tool | Purpose | Install |
|------|---------|---------|
| Node.js 24 | Lambda runtime & local build (matches `.node-version`) | `fnm install 24` |
| pnpm | Package manager | `npm install -g pnpm` |
| AWS CLI v2 | AWS command line | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| aws-vault | Credential management | `brew install aws-vault` |
| Terraform | Infrastructure as Code | `brew install terraform` |
| Terragrunt | Terraform wrapper | `brew install terragrunt` |

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Build Lambda zip files (creates dist/ directory)
pnpm run build

# 3. Run tests (optional but recommended)
pnpm run test

# 4. Deploy infrastructure
cd infrastructure/sandbox/eu-west-2/dice-api
aws-vault exec sandbox -- terragrunt apply

# 5. Terragrunt will show a plan — review and type 'yes' to create resources
```

### What `terragrunt apply` creates

- 1 DynamoDB table
- 6 Lambda functions (with IAM roles and log groups)
- 1 API Gateway HTTP API
- 1 SNS topic
- 3 SQS queues (stats queue + its DLQ, plus the stream-processor DLQ)
- 1 Secrets Manager secret
- 13 CloudWatch alarms (6 Lambda-error + 4 Lambda-duration + API 5xx + SQS message age + DLQ depth)
- S3 bucket + DynamoDB table for Terraform state (if first time)

### What `aws-vault exec sandbox -- ...` means

`aws-vault` injects temporary AWS credentials into the command's environment. It reads your `~/.aws/config` profile, authenticates via SSO, and sets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` for the wrapped command.

### Destroying resources

```bash
cd infrastructure/sandbox/eu-west-2/dice-api
aws-vault exec sandbox -- terragrunt destroy
```

---

## Testing the API

```bash
# Set your API URL (shown in terragrunt output)
API_URL="https://ixvk4ixi35.execute-api.eu-west-2.amazonaws.com"

# Roll a dice
curl -X POST "$API_URL/roll"
# → {"rollId":"...","result":4,"timestamp":"..."}

# Check stats (may take 1-2 seconds to update after rolling)
curl "$API_URL/stats"
# → {"count":1,"sum":4,"min":4,"max":4,"mean":4}

# Get the API key from Secrets Manager
API_KEY=$(aws-vault exec sandbox -- aws secretsmanager get-secret-value \
    --secret-id dice-api-api-key \
    --query SecretString --output text \
    --region eu-west-2)

# Reset all rolls and stats (requires API key)
curl -X DELETE "$API_URL/reset" -H "x-api-key: $API_KEY"
# → {"message":"Reset complete","deletedCount":1}
```

---

## Where to Look When Debugging

| Symptom | Where to check |
|---------|----------------|
| 500 error from API | CloudWatch Logs → `/aws/lambda/dice-api-roll` (or the relevant function) |
| Stats not updating | Check SQS queue depth in console, then `/aws/lambda/dice-api-stats-processor` logs |
| Messages in DLQ | Check DLQ in SQS console — inspect message body to see what failed |
| 403 on reset | Verify `x-api-key` header matches value in Secrets Manager |
| Lambda timeout | Check Duration metric in CloudWatch; consider increasing timeout in Terraform |

---

## Suggested Learning Path

1. Run `pnpm run test` — see what's being tested
2. Read `src/api/roll.ts` — the simplest Lambda, writes to DynamoDB and publishes to SNS
3. Read `src/processors/stats-processor.ts` — see how SQS events are consumed
4. Read `src/utils/update-stats.ts` — understand DynamoDB update expressions
5. Read `docs/architecture.md` — see the full picture
6. Look at `infrastructure/modules/dice-api/lambda-roll.tf` — see how Terraform creates the Lambda and wires it to DynamoDB/SNS
7. Deploy to sandbox with `terragrunt apply`
8. Call the API with curl and watch CloudWatch Logs
9. Read `src/processors/stream-processor.ts` — understand the alternative event path
10. Toggle the stream on and redeploy — see DynamoDB Streams in action
