import EventEmitter from 'events'
import { NeuroConfig } from '../../config'
import { NeuronAuthClient } from './neuron-auth-client'

export interface JWTClaims {
  jti: string // JWT ID
  iss: string // Issuer (Neuron domain)
  client_id: string // Legal ID used to authenticate
  sub: string // Subject (Legal ID of authenticated user)
  aud: string // Audience (PDS domain)
  iat: number // Issued at timestamp
  exp: number // Expiration timestamp
  [key: string]: unknown
}

export interface PetitionState {
  petitionId: string
  legalId: string
  purpose: string
  createdAt: number
  expiresAt: number
  emitter: EventEmitter
  approved?: boolean
  rejected?: boolean
  completedAt?: number
  jwtToken?: string
  claims?: JWTClaims
}

export interface RemoteLoginCallback {
  PetitionId: string
  Rejected: boolean
  Token?: string
}

/**
 * Manages RemoteLogin API interactions with Neuron
 * Handles petition initiation, callback processing, and JWT parsing
 */
export class NeuroRemoteLoginManager {
  private petitions = new Map<string, PetitionState>()
  private authClient: NeuronAuthClient

  constructor(
    private readonly config: NeuroConfig,
    private readonly logger?: any,
  ) {
    if (!config.enabled) {
      throw new Error('Neuro is not enabled')
    }
    this.authClient = new NeuronAuthClient(config)
  }

  /**
   * Initiate a RemoteLogin petition for a user
   */
  async initiatePetition(
    legalId: string,
    purpose: string,
  ): Promise<{
    petitionId: string
    qrCodeUrl?: string
  }> {
    const callbackUrl = `${this.config.callbackBaseUrl}/neuro/remotelogin/callback`

    this.logger?.info(
      {
        legalId: legalId.substring(0, 20) + '...',
        purpose,
        callbackUrl,
      },
      'Initiating RemoteLogin petition',
    )

    const protocol = this.config.domain.startsWith('localhost')
      ? 'http'
      : 'https'

    const fetchOptions = this.authClient.getAuthenticatedFetchOptions('POST', {
      AddressType: 'LegalId',
      Address: legalId,
      ResponseMethod: 'Callback',
      CallbackURL: callbackUrl,
      Seconds: this.config.petitionTimeoutSeconds || 300,
      Purpose: purpose,
    })

    try {
      const fetchResponse = await fetch(
        `${protocol}://${this.config.domain}/RemoteLogin`,
        fetchOptions,
      )

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text()
        this.logger?.error(
          {
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            error: errorText,
          },
          'RemoteLogin API error',
        )
        throw new Error(
          `RemoteLogin API error (${fetchResponse.status}): ${errorText}`,
        )
      }

      const response = await fetchResponse.json()
      const { PetitionId } = response as { PetitionId?: string }

      if (!PetitionId) {
        throw new Error('RemoteLogin API did not return PetitionId')
      }

      // Store petition state
      const emitter = new EventEmitter()
      const now = Date.now()
      const petition: PetitionState = {
        petitionId: PetitionId,
        legalId,
        purpose,
        createdAt: now,
        expiresAt: now + (this.config.petitionTimeoutSeconds || 300) * 1000,
        emitter,
      }

      this.petitions.set(PetitionId, petition)

      this.logger?.info(
        {
          petitionId: PetitionId.substring(0, 8) + '...',
          legalId: legalId.substring(0, 20) + '...',
        },
        'RemoteLogin petition created',
      )

      // QR code is optional with RemoteLogin (push notification is primary)
      return { petitionId: PetitionId }
    } catch (error) {
      this.logger?.error(
        {
          error,
          legalId: legalId.substring(0, 20) + '...',
        },
        'Failed to initiate RemoteLogin petition',
      )
      throw error
    }
  }

  /**
   * Handle callback from Neuron with petition result
   */
  handleCallback(callback: RemoteLoginCallback): void {
    const { PetitionId, Rejected, Token } = callback

    this.logger?.info(
      {
        petitionId: PetitionId.substring(0, 8) + '...',
        rejected: Rejected,
      },
      'RemoteLogin callback received',
    )

    const petition = this.petitions.get(PetitionId)

    if (!petition) {
      this.logger?.warn(
        { petitionId: PetitionId.substring(0, 8) + '...' },
        'Petition not found for callback',
      )
      throw new Error(`Petition not found: ${PetitionId}`)
    }

    // Handle rejection
    if (Rejected) {
      petition.rejected = true
      petition.completedAt = Date.now()
      this.logger?.info(
        { petitionId: PetitionId.substring(0, 8) + '...' },
        'User rejected authentication',
      )
      petition.emitter.emit(
        'rejected',
        new Error('User rejected authentication'),
      )
      return
    }

    // Parse JWT token
    if (!Token) {
      petition.emitter.emit(
        'error',
        new Error('Token missing in approved callback'),
      )
      return
    }

    try {
      const claims = this.parseJwtToken(Token)

      // Store approval
      petition.approved = true
      petition.jwtToken = Token
      petition.claims = claims
      petition.completedAt = Date.now()

      // Extract Legal ID from token
      const legalIdFromToken = claims.sub || claims.client_id

      this.logger?.info(
        {
          petitionId: PetitionId.substring(0, 8) + '...',
          legalId: legalIdFromToken.substring(0, 20) + '...',
        },
        'User approved authentication',
      )

      // Emit approval event with claims
      petition.emitter.emit('approved', {
        legalId: legalIdFromToken,
        claims,
        token: Token,
      })
    } catch (error) {
      this.logger?.error(
        {
          error,
          petitionId: PetitionId.substring(0, 8) + '...',
        },
        'Failed to parse JWT token',
      )
      petition.emitter.emit('error', error)
    }
  }

  /**
   * Wait for petition to be approved or rejected
   */
  async waitForApproval(
    petitionId: string,
  ): Promise<{
    legalId: string
    claims: JWTClaims
    token: string
  }> {
    const petition = this.petitions.get(petitionId)

    if (!petition) {
      throw new Error(`Petition not found: ${petitionId}`)
    }

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.petitions.delete(petitionId)
        reject(new Error('Petition timeout - user did not respond in time'))
      }, petition.expiresAt - Date.now())

      // Listen for approval
      petition.emitter.once('approved', (result) => {
        clearTimeout(timeout)
        this.petitions.delete(petitionId)
        resolve(result)
      })

      // Listen for rejection
      petition.emitter.once('rejected', (error) => {
        clearTimeout(timeout)
        this.petitions.delete(petitionId)
        reject(error)
      })

      // Listen for errors
      petition.emitter.once('error', (error) => {
        clearTimeout(timeout)
        this.petitions.delete(petitionId)
        reject(error)
      })
    })
  }

  /**
   * Parse and optionally verify JWT token
   */
  private parseJwtToken(token: string): JWTClaims {
    // Parse without verification (decode only)
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    try {
      // Decode payload (base64url)
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8')
      const claims = JSON.parse(payload) as JWTClaims

      // Validate required claims
      if (!claims.sub || !claims.iss || !claims.exp) {
        throw new Error('JWT missing required claims (sub, iss, exp)')
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000)
      if (claims.exp < now) {
        throw new Error('JWT token expired')
      }

      this.logger?.debug(
        {
          iss: claims.iss,
          sub: claims.sub?.substring(0, 20) + '...',
          exp: new Date(claims.exp * 1000).toISOString(),
        },
        'JWT token parsed successfully',
      )

      return claims
    } catch (error) {
      this.logger?.error({ error }, 'Failed to parse JWT')
      throw new Error(`Failed to parse JWT token: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Clean up expired petitions
   */
  cleanupExpiredPetitions(): void {
    const now = Date.now()
    for (const [petitionId, petition] of this.petitions.entries()) {
      if (petition.expiresAt < now) {
        this.petitions.delete(petitionId)
        this.logger?.debug(
          { petitionId: petitionId.substring(0, 8) + '...' },
          'Cleaned up expired petition',
        )
      }
    }
  }

  /**
   * Find account by Legal ID
   * This would typically query the database for a user linked to this Legal ID
   */
  async findAccountByLegalId(
    legalId: string,
  ): Promise<{ did: string } | null> {
    // This is a placeholder - in production, this would query the database
    // For now, return null to indicate no account found
    // The actual implementation should be in the oauth-store or account-manager
    this.logger?.warn(
      'findAccountByLegalId called but not yet implemented in database layer',
    )
    return null
  }

  /**
   * Update last login timestamp for Legal ID
   */
  async updateLastLogin(legalId: string): Promise<void> {
    this.logger?.info({ legalId }, 'Updated last login for Legal ID')
    // This would typically update the database
    // Placeholder for now
  }
}
