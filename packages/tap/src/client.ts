import { DidDocument, didDocument } from '@atproto/common'
import { TapChannel, TapHandler, TapWebsocketOptions } from './channel'
import { RepoInfo, repoInfoSchema } from './types'
import { formatAdminAuthHeader } from './util'

export interface TapConfig {
  adminPassword?: string
}

export class Tap {
  url: string
  private adminPassword?: string
  private authHeader?: string

  private addReposUrl: URL
  private removeReposUrl: URL

  constructor(url: string, config: TapConfig = {}) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL, expected http:// or https://')
    }
    this.url = url
    this.adminPassword = config.adminPassword
    if (this.adminPassword) {
      this.authHeader = formatAdminAuthHeader(this.adminPassword)
    }

    this.addReposUrl = new URL('/repos/add', this.url)
    this.removeReposUrl = new URL('/repos/remove', this.url)
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader
    }
    return headers
  }

  channel(handler: TapHandler, opts?: TapWebsocketOptions): TapChannel {
    const url = new URL(this.url)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/channel'
    return new TapChannel(url.toString(), handler, {
      adminPassword: this.adminPassword,
      ...opts,
    })
  }

  async addRepos(dids: string[]): Promise<void> {
    const response = await fetch(this.addReposUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ dids }),
    })
    await response.body?.cancel() // expect empty body

    if (!response.ok) {
      throw new Error(`Failed to add repos: ${response.statusText}`)
    }
  }

  async removeRepos(dids: string[]): Promise<void> {
    const response = await fetch(this.removeReposUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ dids }),
    })
    await response.body?.cancel() // expect empty body

    if (!response.ok) {
      throw new Error(`Failed to remove repos: ${response.statusText}`)
    }
  }

  async resolveDid(did: string): Promise<DidDocument | null> {
    const response = await fetch(new URL(`/resolve/${did}`, this.url), {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (response.status === 404) {
      return null
    } else if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`Failed to resolve DID: ${response.statusText}`)
    }
    return didDocument.parse(await response.json())
  }

  async getRepoInfo(did: string): Promise<RepoInfo> {
    const response = await fetch(new URL(`/info/${did}`, this.url), {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`Failed to get repo info: ${response.statusText}`)
    }

    return repoInfoSchema.parse(await response.json())
  }
}
