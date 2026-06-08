/**
 * Reset Handler — DELETE /reset
 *
 * This Lambda is only accessible via a custom authoriser (see authoriser.ts).
 * It demonstrates:
 * - DynamoDB Scan (reading all items in a table)
 * - BatchWriteItem (deleting up to 25 items per batch — DynamoDB's limit)
 * - Pagination (using LastEvaluatedKey to handle large tables)
 * - Handling UnprocessedItems (DynamoDB may throttle batch operations)
 *
 * In production you'd typically use TTL or table recreation, but this
 * approach shows more DynamoDB concepts.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
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

    let deletedCount = 0
    let lastEvaluatedKey: Record<string, unknown> | undefined

    do {
        const scanResult = await ddbClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            ProjectionExpression: 'pk',
            ExclusiveStartKey: lastEvaluatedKey,
        }))

        const items = scanResult.Items ?? []
        lastEvaluatedKey = scanResult.LastEvaluatedKey

        // BatchWrite in chunks of 25 (DynamoDB limit)
        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25)
            const deleteRequests = batch.map((item) => ({
                DeleteRequest: { Key: { pk: item.pk } },
            }))

            let unprocessed = deleteRequests

            while (unprocessed.length > 0) {
                const result = await ddbClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: unprocessed,
                    },
                }))

                unprocessed = (result.UnprocessedItems?.[TABLE_NAME] ?? []) as typeof unprocessed
            }

            deletedCount += batch.length
        }
    } while (lastEvaluatedKey)

    logger.info('Table reset complete', { deletedCount })

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'Reset complete',
            deletedCount,
        }),
    }
}
