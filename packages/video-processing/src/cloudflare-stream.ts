import type { StreamClient, StreamUploadResult } from './types'

export type CloudflareStreamConfig = {
  accountId: string
  apiToken: string
  /** e.g. https://customer-xxx.cloudflarestream.com */
  customerSubdomain: string
  fetchImpl?: typeof fetch
}

/**
 * Cloudflare Stream REST client (copy-from-URL + delete).
 * Secrets must come from deploy env — never commit tokens.
 */
export class CloudflareStreamClient implements StreamClient {
  private fetchImpl: typeof fetch

  constructor(private cfg: CloudflareStreamConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch
  }

  getPlaybackUrl(uid: string): string {
    const base = this.cfg.customerSubdomain.replace(/\/+$/, '')
    return `${base}/${uid}/manifest/video.m3u8`
  }

  async copyFromUrl(input: {
    url: string
    meta: { did: string; videoCid: string }
  }): Promise<StreamUploadResult> {
    const res = await this.fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${this.cfg.accountId}/stream/copy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: input.url,
          meta: {
            did: input.meta.did,
            videoCid: input.meta.videoCid,
            name: `${input.meta.did}/${input.meta.videoCid}`,
          },
        }),
      },
    )
    const body = (await res.json()) as {
      success?: boolean
      errors?: { message?: string }[]
      result?: {
        uid?: string
        readyToStream?: boolean
        playback?: { hls?: string }
      }
    }
    if (!res.ok || !body.success || !body.result?.uid) {
      const detail = body.errors?.[0]?.message ?? res.statusText
      throw new Error(`Stream copy failed: ${detail}`)
    }
    return {
      uid: body.result.uid,
      playbackUrl: body.result.readyToStream
        ? body.result.playback?.hls ?? this.getPlaybackUrl(body.result.uid)
        : undefined,
    }
  }

  async delete(uid: string): Promise<void> {
    const res = await this.fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${this.cfg.accountId}/stream/${encodeURIComponent(uid)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.cfg.apiToken}` },
      },
    )
    if (res.status === 404) return
    const body = (await res.json().catch(() => null)) as {
      success?: boolean
      errors?: { message?: string }[]
    } | null
    if (!res.ok || body?.success === false) {
      const detail = body?.errors?.[0]?.message ?? res.statusText
      throw new Error(`Stream delete failed: ${detail}`)
    }
  }
}
