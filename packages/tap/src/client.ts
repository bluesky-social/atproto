import { TapChannel, TapHandler, TapWebsocketOptions } from './channel'

export class Tap {
  url: string

  constructor(url: string) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL, expected http:// or https://')
    }
    this.url = url
  }

  channel(handler: TapHandler, opts?: TapWebsocketOptions): TapChannel {
    const url = new URL(this.url)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/channel'
    return new TapChannel(url.toString(), handler, opts)
  }

  async addRepos(dids: string[]): Promise<void> {
    const response = await fetch(`${this.url}/add-repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dids }),
    })
    await response.arrayBuffer()

    if (!response.ok) {
      await response.arrayBuffer()
      throw new Error(`Failed to add repos: ${response.statusText}`)
    }
  }

  async removeRepos(dids: string[]): Promise<void> {
    const response = await fetch(`${this.url}/remove-repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dids }),
    })
    await response.arrayBuffer()

    if (!response.ok) {
      await response.arrayBuffer()
      throw new Error(`Failed to remove repos: ${response.statusText}`)
    }
  }
}
