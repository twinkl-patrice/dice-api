/**
 * Stats Processor — SQS Event Handler
 *
 * This Lambda is triggered by SQS, NOT by API Gateway. When messages arrive
 * in the stats queue, Lambda polls the queue and invokes this handler with
 * a batch of messages (up to 10 at a time, configured in Terraform).
 *
 * The message flow is:
 * 1. Roll Lambda publishes to SNS topic
 * 2. SNS delivers to SQS queue (fan-out pattern — could have multiple subscribers)
 * 3. Lambda polls SQS and invokes this handler with a batch
 *
 * The SQS event wraps the SNS notification, so we double-parse:
 * record.body → SNS envelope (JSON) → .Message → our payload (JSON)
 *
 * If this Lambda throws, SQS will retry delivery (up to 3 times) before
 * sending the message to the Dead Letter Queue (DLQ).
 */
import { Logger } from '@aws-lambda-powertools/logger'
import type { SQSHandler } from 'aws-lambda'
import { updateStats } from '../utils/update-stats.js'

/**
 * AWS SDK clients are created OUTSIDE the handler function so they persist
 * across invocations in the same Lambda execution environment (warm starts).
 */
const logger = new Logger({ serviceName: 'dice-api', logLevel: 'INFO' })

/** Environment variable injected by Terraform — the DynamoDB table name. */
const TABLE_NAME = process.env.TABLE_NAME!

export const handler: SQSHandler = async (event, context) => {
    logger.addContext(context)
    logger.logEventIfEnabled(event)

    for (const record of event.Records) {
        const snsMessage = JSON.parse(record.body)
        const payload = JSON.parse(snsMessage.Message)
        const { rollId, result } = payload as { rollId: string; result: number }

        logger.info('Processing roll for stats', { rollId, result })

        await updateStats(TABLE_NAME, result)
    }
}
