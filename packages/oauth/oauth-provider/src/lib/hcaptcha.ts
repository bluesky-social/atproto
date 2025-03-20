import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  Fetch,
  FetchBound,
  bindFetch,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'

export const hcaptchaTokenSchema = z.string().min(1)
export type HcaptchaToken = z.infer<typeof hcaptchaTokenSchema>

export const hcaptchaConfigSchema = z.object({
  /**
   * The hCaptcha site key to use for the sign-up form.
   */
  siteKey: z.string().min(1),
  /**
   * The hCaptcha secret key to use for the sign-up form.
   */
  secretKey: z.string().min(1),
  /**
   * A salt to use when hashing client tokens.
   */
  tokenSalt: z.string().min(1),
  /**
   * The risk score above which the user is considered a threat and will be
   * denied access. This will be ignored if the enterprise features are not
   * available.
   *
   * Note: Score values ranges from 0.0 (no risk) to 1.0 (confirmed threat).
   */
  scoreThreshold: z.number().optional(),
})
export type HcaptchaConfig = z.infer<typeof hcaptchaConfigSchema>

/**
 * @see {@link https://docs.hcaptcha.com/#verify-the-user-response-server-side hCaptcha API}
 */
export const hcaptchaVerifyResultSchema = z.object({
  /**
   * is the passcode valid, and does it meet security criteria you specified, e.g. sitekey?
   */
  success: z.boolean(),
  /**
   * timestamp of the challenge (ISO format yyyy-MM-dd'T'HH:mm:ssZZ)
   */
  challenge_ts: z.string(),
  /**
   * the hostname of the site where the challenge was passed
   */
  hostname: z.string().nullable(),
  /**
   * optional: any error codes returned by the hCaptcha API.
   * @see {@link https://docs.hcaptcha.com/#siteverify-error-codes-table}
   */
  'error-codes': z.array(z.string()).optional(),
  /**
   * ENTERPRISE feature: a score denoting malicious activity. Value ranges from
   * 0.0 (no risk) to 1.0 (confirmed threat).
   */
  score: z.number().optional(),
  /**
   * ENTERPRISE feature: reason(s) for score.
   */
  score_reason: z.array(z.string()).optional(),
  /**
   * sitekey of the request
   */
  sitekey: z.string().optional(),
  /**
   * obj of form: {'ip_device': 1, .. etc}
   */
  behavior_counts: z.record(z.unknown()).optional(),
  /**
   * how similar is this? (0.0 - 1.0, -1 on err)
   */
  similarity: z.number().optional(),
  /**
   * count of similar_tokens not processed
   */
  similarity_failures: z.number().optional(),
  /**
   * array of strings for any similarity errors
   */
  similarity_error_details: z.array(z.string()).optional(),
  /**
   * encoded clientID
   */
  scoped_uid_0: z.string().optional(),
  /**
   * encoded IP
   */
  scoped_uid_1: z.string().optional(),
  /**
   * encoded IP (APT)
   */
  scoped_uid_2: z.string().optional(),
  /**
   * Risk Insights (APT + RI)
   */
  risk_insights: z.record(z.unknown()).optional(),
  /**
   * Advanced Threat Signatures (APT)
   */
  sigs: z.record(z.unknown()).optional(),
  /**
   * tags added via Rules
   */
  tags: z.array(z.string()).optional(),
})

export type HcaptchaVerifyResult = z.infer<typeof hcaptchaVerifyResultSchema>

const fetchSuccessHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor(),
  fetchJsonZodProcessor(hcaptchaVerifyResultSchema),
)

export class HCaptchaClient {
  protected readonly fetch: FetchBound
  constructor(
    private readonly hostname: string,
    private readonly config: HcaptchaConfig,
    fetch: Fetch = globalThis.fetch,
  ) {
    this.fetch = bindFetch(fetch)
  }

  public async verify(
    behaviorType: 'login' | 'signup',
    response: string,
    remoteip: string,
    handle: string,
    userAgent?: string,
  ) {
    const result = await this.fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: this.config.secretKey,
        sitekey: this.config.siteKey,
        behavior_type: behaviorType,
        response,
        remoteip,
        client_tokens: JSON.stringify({
          hashedIp: this.hashToken(remoteip),
          hashedHandle: this.hashToken(handle),
          hashedUserAgent: userAgent ? this.hashToken(userAgent) : undefined,
        }),
      }).toString(),
    }).then(fetchSuccessHandler)

    return {
      allowed: this.isAllowed(result),
      result,
    }
  }

  protected isAllowed({ success, hostname, score }: HcaptchaVerifyResult) {
    return (
      success &&
      // Fool-proofing: If this is false, the user is trying to use a token
      // generated for the same siteKey, but on another domain.
      hostname === this.hostname &&
      // Ignore if enterprise feature is not enabled
      (score == null ||
        // Ignore if disabled through config
        this.config.scoreThreshold == null ||
        score < this.config.scoreThreshold)
    )
  }

  protected hashToken(value: string) {
    const hash = createHash('sha256')
    hash.update(this.config.tokenSalt)
    hash.update(value)
    return hash.digest().toString('base64')
  }
}
