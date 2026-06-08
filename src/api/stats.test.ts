import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(() => ({ send: mockSend })),
    },
    GetCommand: vi.fn((input) => ({ input })),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        logEventIfEnabled: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('stats handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.TABLE_NAME = 'test-table'
    })

    it('should return empty stats when no STATS item exists', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })

        const { handler } = await import('./stats')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        const body = JSON.parse((result as any).body)
        expect(body).toEqual({
            count: 0,
            sum: 0,
            min: null,
            max: null,
            mean: null,
        })
    })

    it('should return computed stats with mean', async () => {
        mockSend.mockResolvedValueOnce({
            Item: { pk: 'STATS', count: 10, sum: 35, min: 1, max: 6 },
        })

        const { handler } = await import('./stats')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        const body = JSON.parse((result as any).body)
        expect(body.count).toBe(10)
        expect(body.sum).toBe(35)
        expect(body.min).toBe(1)
        expect(body.max).toBe(6)
        expect(body.mean).toBe(3.5)
    })
})
