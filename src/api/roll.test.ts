import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(() => ({ send: mockSend })),
    },
    PutCommand: vi.fn((input) => ({ input })),
}))

vi.mock('@aws-sdk/client-sns', () => ({
    SNSClient: vi.fn(() => ({ send: mockSend })),
    PublishCommand: vi.fn((input) => ({ input, _type: 'sns' })),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        logEventIfEnabled: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('roll handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSend.mockResolvedValue({})
        process.env.TABLE_NAME = 'test-table'
        process.env.TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789:test-topic'
        process.env.DIRECT_PUBLISH_ENABLED = 'true'
    })

    it('should return a roll result between 1 and 6', async () => {
        const { handler } = await import('./roll')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        const body = JSON.parse((result as any).body)
        expect(body.result).toBeGreaterThanOrEqual(1)
        expect(body.result).toBeLessThanOrEqual(6)
        expect(body.rollId).toBeDefined()
        expect(body.timestamp).toBeDefined()
    })

    it('should return status 200', async () => {
        const { handler } = await import('./roll')

        const result = await handler(
            { headers: {}, requestContext: {} } as any,
            {} as any,
            vi.fn(),
        )

        expect((result as any).statusCode).toBe(200)
    })
})
