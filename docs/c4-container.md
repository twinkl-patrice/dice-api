# C4 Container Diagram

```mermaid
flowchart TB
    subgraph external["External Actors"]
        client["API Client"]
    end

    subgraph system["Dice API System Boundary"]
        apigw["API Gateway HTTP API"]
        
        subgraph lambdas["Lambda Functions"]
            roll-lambda["Roll Lambda"]
            stats-lambda["Stats Lambda"]
            reset-lambda["Reset Lambda"]
            authoriser-lambda["Authoriser Lambda"]
            stats-processor["Stats Processor Lambda"]
            stream-processor["Stream Processor Lambda"]
        end

        subgraph storage["Storage"]
            dynamodb["DynamoDB Table\n(dice-api-rolls)"]
        end

        subgraph messaging["Messaging"]
            sns-topic["SNS Topic\n(roll-events)"]
            sqs-queue["SQS Queue\n(stats-queue)"]
            stats-dlq["SQS DLQ\n(stats-dlq)"]
            stream-dlq["SQS DLQ\n(stream-dlq)"]
        end

        subgraph security["Security"]
            secrets["Secrets Manager\n(API Key)"]
        end

        subgraph monitoring["Monitoring"]
            alarms["CloudWatch Alarms\n(errors, 5xx, duration,\nqueue age, DLQ depth)"]
        end
    end

    client -->|"POST /roll"| apigw
    client -->|"GET /stats"| apigw
    client -->|"DELETE /reset"| apigw

    apigw -->|"Validates x-api-key\n(reset only)"| authoriser-lambda
    authoriser-lambda -->|"Reads API key"| secrets
    
    apigw -->|"Invokes"| roll-lambda
    apigw -->|"Invokes"| stats-lambda
    apigw -->|"Invokes (authorised)"| reset-lambda

    roll-lambda -->|"PutItem (roll record)"| dynamodb
    roll-lambda -->|"Publish roll event"| sns-topic

    stats-lambda -->|"GetItem (STATS key)"| dynamodb

    reset-lambda -->|"Scan + BatchDelete"| dynamodb

    dynamodb -.->|"Stream (disabled by default)"| stream-processor
    stream-processor -->|"Publish roll event"| sns-topic
    stream-processor -.->|"Failed records"| stream-dlq

    sns-topic -->|"Delivers messages"| sqs-queue
    sqs-queue -->|"Triggers batch processing"| stats-processor
    sqs-queue -.->|"Failed messages (3 retries)"| stats-dlq
    stats-processor -->|"UpdateItem (incremental stats)"| dynamodb

    alarms -.->|"Monitors"| roll-lambda
    alarms -.->|"Monitors"| stats-lambda
    alarms -.->|"Monitors"| reset-lambda
    alarms -.->|"Monitors"| stats-processor
    alarms -.->|"Monitors"| apigw
    alarms -.->|"Monitors"| sqs-queue
    alarms -.->|"Monitors"| stats-dlq
```

## Description

This C4 Container diagram shows the Dice API system deployed in AWS. The system is a workshop demonstration of multiple AWS services working together:

- **API Gateway** exposes three HTTP endpoints for rolling dice, viewing stats, and resetting the table
- **Lambda functions** handle each concern independently with ARM64 architecture
- **DynamoDB** stores individual roll records and an aggregated stats record using single-table design
- **SNS + SQS** decouple the roll event from stats computation, processing asynchronously
- **DynamoDB Streams** provides an alternative event source (disabled by default, toggled for workshop)
- **Secrets Manager** stores the API key used by the authoriser Lambda
- **CloudWatch Alarms** monitor errors, latency, and queue health across all components

Dashed lines indicate optional/disabled paths or monitoring relationships.
