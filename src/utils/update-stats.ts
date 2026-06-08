/**
 * Update Stats — Shared utility for incremental statistics computation
 *
 * Instead of scanning all rolls to compute stats (O(n)), we maintain a
 * running aggregate using DynamoDB's atomic update operations:
 *
 * - ADD: atomically increments count and sum (no read-modify-write needed)
 * - Conditional SET: updates min/max only if the new value is lower/higher
 *
 * We use THREE separate UpdateItem calls because DynamoDB's ConditionExpression
 * applies to the entire update — if we combined count/sum with a conditional
 * min update, a failed condition would skip the count/sum increment too.
 *
 * The ConditionalCheckFailedException is expected and swallowed — it just
 * means the roll wasn't a new min/max.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export const updateStats = async (tableName: string, result: number): Promise<void> => {
    // Always increment count and sum
    await ddbClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { pk: 'STATS' },
        UpdateExpression: 'ADD #count :one, #sum :result',
        ExpressionAttributeNames: {
            '#count': 'count',
            '#sum': 'sum',
        },
        ExpressionAttributeValues: {
            ':one': 1,
            ':result': result,
        },
    }))

    // Conditionally update min
    try {
        await ddbClient.send(new UpdateCommand({
            TableName: tableName,
            Key: { pk: 'STATS' },
            UpdateExpression: 'SET #min = :result',
            ConditionExpression: 'attribute_not_exists(#min) OR :result < #min',
            ExpressionAttributeNames: { '#min': 'min' },
            ExpressionAttributeValues: { ':result': result },
        }))
    } catch (error: unknown) {
        if ((error as { name: string }).name !== 'ConditionalCheckFailedException') throw error
    }

    // Conditionally update max
    try {
        await ddbClient.send(new UpdateCommand({
            TableName: tableName,
            Key: { pk: 'STATS' },
            UpdateExpression: 'SET #max = :result',
            ConditionExpression: 'attribute_not_exists(#max) OR :result > #max',
            ExpressionAttributeNames: { '#max': 'max' },
            ExpressionAttributeValues: { ':result': result },
        }))
    } catch (error: unknown) {
        if ((error as { name: string }).name !== 'ConditionalCheckFailedException') throw error
    }
}
