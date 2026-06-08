import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateStats = vi.fn()

vi.mock('../utils/update-stats', () => ({
    updateStats: (...args: unknown[]) => mockUpdateStats(...args),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        logEventIfEnabled: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('stats-processor handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpdateStats.mockResolvedValue(undefined)
        process.env.TABLE_NAME = 'test-table'
    })

    it('should process SQS records with SNS messages', async () => {
        const { handler } = await import('./stats-processor')

        const event = {
            Records: [
                {
                    body: JSON.stringify({
                        Message: JSON.stringify({ rollId: 'abc', result: 4, timestamp: '2026-01-01T00:00:00Z' }),
                    }),
                },
                {
                    body: JSON.stringify({
                        Message: JSON.stringify({ rollId: 'def', result: 6, timestamp: '2026-01-01T00:01:00Z' }),
                    }),
                },
            ],
        }

        await handler(event as any, {} as any, vi.fn())

        expect(mockUpdateStats).toHaveBeenCalledTimes(2)
        expect(mockUpdateStats).toHaveBeenCalledWith('test-table', 4)
        expect(mockUpdateStats).toHaveBeenCalledWith('test-table', 6)
    })
})
