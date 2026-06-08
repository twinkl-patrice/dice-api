import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManagerClient: vi.fn(() => ({ send: mockSend })),
    GetSecretValueCommand: vi.fn((input) => ({ input })),
}))

vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn(() => ({
        addContext: vi.fn(),
        info: vi.fn(),
    })),
}))

describe('authoriser handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        process.env.SECRET_NAME = 'test-secret'
        mockSend.mockResolvedValue({ SecretString: 'valid-api-key-123' })
    })

    it('should deny when no x-api-key header is provided', async () => {
        const { handler } = await import('./authoriser')

        const result = await handler(
            { headers: {} } as any,
            {} as any,
        )

        expect(result).toEqual({ isAuthorized: false })
    })

    it('should deny when invalid key is provided', async () => {
        const { handler } = await import('./authoriser')

        const result = await handler(
            { headers: { 'x-api-key': 'wrong-key' } } as any,
            {} as any,
        )

        expect(result).toEqual({ isAuthorized: false })
    })

    it('should allow when valid key is provided', async () => {
        const { handler } = await import('./authoriser')

        const result = await handler(
            { headers: { 'x-api-key': 'valid-api-key-123' } } as any,
            {} as any,
        )

        expect(result).toEqual({ isAuthorized: true })
    })
})
