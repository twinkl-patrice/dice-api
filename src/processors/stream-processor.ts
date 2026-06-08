/**
 * Stream Processor — DynamoDB Streams Event Handler
 *
 * This Lambda is triggered by DynamoDB Streams, an alternative to the
 * SNS publish approach. When items are written/updated/deleted in the table,
 * DynamoDB Streams captures the change and invokes this Lambda.
 *
 * Key concepts:
 * - DynamoDB Streams guarantee ordering per partition key
 * - Each record contains the old and/or new image of the item
 * - We filter for INSERT events only (configured in Terraform as an event
 *   source mapping filter, and double-checked in code)
 * - We skip STATS item changes to avoid infinite loops
 * - The event source mapping is DISABLED by default — enable it during
 *   the workshop to demonstrate this alternative pattern
 *
 * Unlike SQS, stream failures use bisect-on-error: if a batch fails,
 * Lambda splits it in half and retries. After max retries, failed records
 * go to the stream DLQ (configured as an on_failure destination).
 */
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { Logger } from '@aws-lambda-powertools/logger'
import type { DynamoDBStreamHandler } from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'

/**
 * AWS SDK clients are created OUTSIDE the handler function so they persist
 * across invocations in the same Lambda execution environment (warm starts).
 */
const logger = new Logger({ serviceName: 'dice-api', logLevel: 'INFO' })
const snsClient = new SNSClient({})

/** Environment variable injected by Terraform — the SNS topic ARN to publish to. */
const TOPIC_ARN = process.env.TOPIC_ARN!

export const handler: DynamoDBStreamHandler = async (event, context) => {
    logger.addContext(context)
    logger.logEventIfEnabled(event)

    for (const record of event.Records) {
        if (record.eventName !== 'INSERT') {
            logger.info('Skipping non-INSERT event', { eventName: record.eventName })
            continue
        }

        const newImage = record.dynamodb?.NewImage
        if (!newImage) continue

        const item = unmarshall(newImage as Record<string, AttributeValue>)

        // Only process roll items, not STATS
        if (!item.pk?.startsWith('ROLL#')) continue

        const message = {
            rollId: item.rollId,
            result: item.result,
            timestamp: item.timestamp,
        }

        await snsClient.send(new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify(message),
        }))

        logger.info('Published stream event to SNS', { rollId: item.rollId })
    }
}
