import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-sns', () => ({
    SNSClient: vi.fn(() => ({ send: mockSend })),
    PublishCommand: vi.fn((input) => ({ input })),
}))

vi.mock('@aws-sdk/util-dynamodb', () => ({
    unmarshall: vi.fn((item) => {
        // Simple mock unmarshall that extracts .S and .N values
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(item as Record<string, any>)) {
            if (value.S) result[key] = value.S
            else if (value.N) result[key] = Number(value.N)
            else result[key] = value
        }
        return result
    }),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        logEventIfEnabled: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('stream-processor handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSend.mockResolvedValue({})
        process.env.TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789:test-topic'
    })

    it('should publish INSERT events for roll items to SNS', async () => {
        const { handler } = await import('./stream-processor')

        const event = {
            Records: [
                {
                    eventName: 'INSERT',
                    dynamodb: {
                        NewImage: {
                            pk: { S: 'ROLL#abc-123' },
                            rollId: { S: 'abc-123' },
                            result: { N: '4' },
                            timestamp: { S: '2026-01-01T00:00:00Z' },
                        },
                    },
                },
            ],
        }

        await handler(event as any, {} as any, vi.fn())

        expect(mockSend).toHaveBeenCalledTimes(1)
        const publishInput = mockSend.mock.calls[0]![0].input
        expect(publishInput.TopicArn).toBe('arn:aws:sns:eu-west-2:123456789:test-topic')
        const message = JSON.parse(publishInput.Message)
        expect(message.rollId).toBe('abc-123')
        expect(message.result).toBe(4)
    })

    it('should skip non-INSERT events', async () => {
        const { handler } = await import('./stream-processor')

        const event = {
            Records: [
                {
                    eventName: 'REMOVE',
                    dynamodb: {
                        NewImage: { pk: { S: 'ROLL#abc' } },
                    },
                },
            ],
        }

        await handler(event as any, {} as any, vi.fn())

        expect(mockSend).not.toHaveBeenCalled()
    })

    it('should skip STATS item inserts', async () => {
        const { handler } = await import('./stream-processor')

        const event = {
            Records: [
                {
                    eventName: 'INSERT',
                    dynamodb: {
                        NewImage: {
                            pk: { S: 'STATS' },
                            count: { N: '1' },
                        },
                    },
                },
            ],
        }

        await handler(event as any, {} as any, vi.fn())

        expect(mockSend).not.toHaveBeenCalled()
    })
})
