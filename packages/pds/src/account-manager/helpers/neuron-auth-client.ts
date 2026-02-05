import { NeuroConfig } from '../../config'

/**
 * Handles authentication for RemoteLogin API requests to Neuron
 */
export class NeuronAuthClient {
  constructor(private config: NeuroConfig) {
    if (!config.enabled) {
      throw new Error('Neuro is not enabled')
    }
  }

  /**
   * Get Authorization header value based on configured auth method
   */
  getAuthHeader(): string | undefined {
    switch (this.config.authMethod) {
      case 'bearer':
        if (!this.config.bearerToken) {
          throw new Error('Bearer token not configured for Neuro RemoteLogin')
        }
        return `Bearer ${this.config.bearerToken}`

      case 'basic':
        if (!this.config.basicUsername || !this.config.basicPassword) {
          throw new Error(
            'Basic auth credentials not configured for Neuro RemoteLogin',
          )
        }
        const credentials = Buffer.from(
          `${this.config.basicUsername}:${this.config.basicPassword}`,
        ).toString('base64')
        return `Basic ${credentials}`

      case 'mtls':
        // mTLS authentication happens at TLS layer, no Authorization header needed
        return undefined

      default:
        // Default to basic auth if not specified
        if (this.config.basicUsername && this.config.basicPassword) {
          const credentials = Buffer.from(
            `${this.config.basicUsername}:${this.config.basicPassword}`,
          ).toString('base64')
          return `Basic ${credentials}`
        }
        throw new Error(
          `Unknown or unconfigured auth method: ${this.config.authMethod}`,
        )
    }
  }

  /**
   * Get fetch options with authentication headers
   */
  getAuthenticatedFetchOptions(method: string, body?: object): RequestInit {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    // Add auth header if needed
    const authHeader = this.getAuthHeader()
    if (authHeader) {
      options.headers = {
        ...options.headers,
        Authorization: authHeader,
      }
    }

    // Add body if provided
    if (body) {
      options.body = JSON.stringify(body)
    }

    return options
  }
}
