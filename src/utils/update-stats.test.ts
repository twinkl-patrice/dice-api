import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', async () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(() => ({ send: (...args: unknown[]) => mockSend(...args) })),
    },
    UpdateCommand: vi.fn((input: unknown) => ({ input })),
}))

const { updateStats } = await import('./update-stats')

describe('updateStats', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSend.mockResolvedValue({})
    })

    it('should send three update commands', async () => {
        await updateStats('test-table', 4)

        expect(mockSend).toHaveBeenCalledTimes(3)
    })

    it('should increment count and sum in the first update', async () => {
        await updateStats('test-table', 5)

        const firstCall = mockSend.mock.calls[0]![0]
        expect(firstCall.input.TableName).toBe('test-table')
        expect(firstCall.input.Key).toEqual({ pk: 'STATS' })
        expect(firstCall.input.UpdateExpression).toContain('ADD')
        expect(firstCall.input.ExpressionAttributeValues[':one']).toBe(1)
        expect(firstCall.input.ExpressionAttributeValues[':result']).toBe(5)
    })

    it('should conditionally update min', async () => {
        await updateStats('test-table', 2)

        const secondCall = mockSend.mock.calls[1]![0]
        expect(secondCall.input.UpdateExpression).toContain('#min')
        expect(secondCall.input.ConditionExpression).toContain(':result < #min')
        expect(secondCall.input.ExpressionAttributeValues[':result']).toBe(2)
    })

    it('should conditionally update max', async () => {
        await updateStats('test-table', 6)

        const thirdCall = mockSend.mock.calls[2]![0]
        expect(thirdCall.input.UpdateExpression).toContain('#max')
        expect(thirdCall.input.ConditionExpression).toContain(':result > #max')
        expect(thirdCall.input.ExpressionAttributeValues[':result']).toBe(6)
    })

    it('should not throw when min conditional check fails', async () => {
        mockSend
            .mockResolvedValueOnce({}) // count/sum succeeds
            .mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' }) // min fails
            .mockResolvedValueOnce({}) // max succeeds

        await expect(updateStats('test-table', 3)).resolves.not.toThrow()
    })

    it('should not throw when max conditional check fails', async () => {
        mockSend
            .mockResolvedValueOnce({}) // count/sum succeeds
            .mockResolvedValueOnce({}) // min succeeds
            .mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' }) // max fails

        await expect(updateStats('test-table', 3)).resolves.not.toThrow()
    })

    it('should rethrow non-conditional errors', async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('NetworkError'))

        await expect(updateStats('test-table', 3)).rejects.toThrow('NetworkError')
    })
})
