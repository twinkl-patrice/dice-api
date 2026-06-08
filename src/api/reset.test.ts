import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(() => ({ send: mockSend })),
    },
    ScanCommand: vi.fn((input) => ({ input })),
    BatchWriteCommand: vi.fn((input) => ({ input })),
    DeleteCommand: vi.fn((input) => ({ input })),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        logEventIfEnabled: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('reset handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.TABLE_NAME = 'test-table'
    })

    it('should return success with deleted count', async () => {
        mockSend.mockResolvedValueOnce({
            Items: [{ pk: 'ROLL#1' }, { pk: 'ROLL#2' }, { pk: 'STATS' }],
            LastEvaluatedKey: undefined,
        })
        mockSend.mockResolvedValueOnce({ UnprocessedItems: {} }) // batch write

        const { handler } = await import('./reset')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        expect((result as any).statusCode).toBe(200)
        const body = JSON.parse((result as any).body)
        expect(body.message).toBe('Reset complete')
        expect(body.deletedCount).toBe(3)
    })

    it('should handle empty table', async () => {
        mockSend.mockResolvedValueOnce({
            Items: [],
            LastEvaluatedKey: undefined,
        })

        const { handler } = await import('./reset')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        const body = JSON.parse((result as any).body)
        expect(body.deletedCount).toBe(0)
    })
})
