/**
 * Custom Authoriser — Lambda Request Authoriser for API Gateway
 *
 * API Gateway HTTP APIs (v2) support custom Lambda authorisers. When a route
 * is configured with an authoriser, API Gateway calls this Lambda BEFORE the
 * target handler. If it returns { isAuthorized: false }, the client gets a
 * 403 Forbidden and the target Lambda is never invoked.
 *
 * This authoriser checks the x-api-key header against a secret stored in
 * AWS Secrets Manager. The secret value is cached in memory (module-level
 * variable) so we only call Secrets Manager once per Lambda cold start.
 *
 * Note: This is a "simple response" authoriser — it returns a boolean.
 * There's also an "IAM policy" response format for more complex scenarios.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { Logger } from '@aws-lambda-powertools/logger'
import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda'

const logger = new Logger({ serviceName: 'dice-api', logLevel: 'INFO' })
const secretsClient = new SecretsManagerClient({})

/** Environment variable injected by Terraform — the Secrets Manager secret name. */
const SECRET_NAME = process.env.SECRET_NAME!

/**
 * Module-level cache for the API key. Because Lambda reuses execution
 * environments, this variable persists across invocations (warm starts).
 * First invocation fetches from Secrets Manager; subsequent ones use cache.
 */
let cachedApiKey: string | undefined

const getApiKey = async (): Promise<string> => {
    if (cachedApiKey) return cachedApiKey

    const response = await secretsClient.send(new GetSecretValueCommand({
        SecretId: SECRET_NAME,
    }))

    cachedApiKey = response.SecretString!
    return cachedApiKey
}

export const handler = async (event: APIGatewayRequestAuthorizerEventV2, context: unknown) => {
    logger.addContext(context as any)

    const providedKey = event.headers?.['x-api-key']

    if (!providedKey) {
        logger.info('No API key provided')
        return { isAuthorized: false }
    }

    const expectedKey = await getApiKey()

    const isAuthorized = providedKey === expectedKey

    if (!isAuthorized) {
        logger.info('Invalid API key provided')
    }

    return { isAuthorized }
}
