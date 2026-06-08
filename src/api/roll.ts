/**
 * Roll Handler — POST /roll
 *
 * This Lambda is invoked by API Gateway when a client calls POST /roll.
 * It demonstrates:
 * - Writing an item to DynamoDB (PutCommand)
 * - Publishing a message to an SNS topic for async processing
 * - Reading environment variables injected by Terraform
 *
 * The handler receives an APIGatewayProxyEventV2 (HTTP API v2 format) which
 * contains headers, path parameters, query strings, and body. Since this
 * endpoint takes no input, we ignore the event body.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { Logger } from '@aws-lambda-powertools/logger'
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { randomUUID } from 'node:crypto'

/**
 * AWS SDK clients are created OUTSIDE the handler function. This is important
 * because Lambda reuses the execution environment across invocations (called
 * "warm starts"). By creating clients at module level, they are only
 * instantiated once and reused, saving time on subsequent invocations.
 */
const logger = new Logger({ serviceName: 'dice-api', logLevel: 'INFO' })
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const snsClient = new SNSClient({})

/**
 * Environment variables injected by Terraform. The non-null assertion (!)
 * tells TypeScript we trust these will always be set at runtime.
 */
const TABLE_NAME = process.env.TABLE_NAME!
const TOPIC_ARN = process.env.TOPIC_ARN!

/**
 * Workshop toggle: when true, this Lambda publishes directly to SNS after
 * writing the roll. When false, we rely on DynamoDB Streams to trigger the
 * stream-processor Lambda instead. Only one path should be active at a time
 * to avoid double-counting stats. Controlled via Terraform variable.
 */
const DIRECT_PUBLISH_ENABLED = process.env.DIRECT_PUBLISH_ENABLED === 'true'

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    logger.addContext(context)
    logger.logEventIfEnabled(event)

    const rollId = randomUUID()
    const result = Math.floor(Math.random() * 6) + 1
    const timestamp = new Date().toISOString()

    await ddbClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            pk: `ROLL#${rollId}`,
            rollId,
            result,
            timestamp,
        },
    }))

    logger.info('Roll recorded', { rollId, result })

    if (DIRECT_PUBLISH_ENABLED) {
        await snsClient.send(new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify({ rollId, result, timestamp }),
        }))

        logger.info('Published to SNS', { rollId })
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollId, result, timestamp }),
    }
}
