import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  Fetch,
  FetchBound,
  bindFetch,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'

export const hibpConfigSchema = z.object({
  /**
   * Whether to enable HaveIBeenPwned password breach check
   */
  enabled: z.boolean().optional(),
})

export type HibpConfig = z.infer<typeof hibpConfigSchema>

const HIBP_API_URL = 'https://api.pwnedpasswords.com/range'

export class HibpClient {
  protected readonly fetch: FetchBound

  constructor(fetch: Fetch = globalThis.fetch) {
    this.fetch = bindFetch(fetch)
  }

  async isPasswordBreached(password: string): Promise<boolean> {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    try {
      const response = await this.fetch(`${HIBP_API_URL}/${prefix}`, {
        headers: {
          'Add-Padding': 'true', // https://haveibeenpwned.com/API/v3#PwnedPasswordsPadding
          'User-Agent': 'atproto-oauth-provider',
        },
      }).then(pipe(fetchOkProcessor(), async (res) => res.text()))

      const lines = response.split('\n')
      for (const line of lines) {
        const [hashSuffix, count] = line.split(':')

        if (hashSuffix.trim() === suffix && count > 0) {
          return true
        }
      }

      return false
    } catch {
      return false
    }
  }
}
