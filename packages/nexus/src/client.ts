import { NexusChannel, NexusHandler, NexusWebsocketOptions } from './channel'

export class Nexus {
  url: string

  constructor(url: string) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL, expected http:// or https://')
    }
    this.url = url
  }

  channel(handler: NexusHandler, opts?: NexusWebsocketOptions): NexusChannel {
    const url = new URL(this.url)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/channel'
    return new NexusChannel(url.toString(), handler, opts)
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
