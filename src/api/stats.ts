/**
 * Stats Handler — GET /stats
 *
 * This Lambda reads the pre-computed statistics from DynamoDB. Rather than
 * scanning all roll records on every request (expensive), we maintain a single
 * "STATS" item that is updated asynchronously by the stats-processor Lambda.
 *
 * This demonstrates the "read model" pattern: the API reads from a
 * pre-computed view rather than computing on the fly. The tradeoff is
 * eventual consistency — stats may lag behind by a few seconds.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { Logger } from '@aws-lambda-powertools/logger'
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'

/**
 * AWS SDK clients are created OUTSIDE the handler function so they persist
 * across invocations in the same Lambda execution environment (warm starts).
 */
const logger = new Logger({ serviceName: 'dice-api', logLevel: 'INFO' })
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

/** Environment variable injected by Terraform — the DynamoDB table name. */
const TABLE_NAME = process.env.TABLE_NAME!

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    logger.addContext(context)
    logger.logEventIfEnabled(event)

    const response = await ddbClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'STATS' },
    }))

    const stats = response.Item

    if (!stats) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                count: 0,
                sum: 0,
                min: null,
                max: null,
                mean: null,
            }),
        }
    }

    const mean = stats.count > 0 ? stats.sum / stats.count : null

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            count: stats.count,
            sum: stats.sum,
            min: stats.min,
            max: stats.max,
            mean: mean ? Math.round(mean * 100) / 100 : null,
        }),
    }
}
