import { NexusChannel, NexusHandler, NexusWebsocketOptions } from './channel'

export class Nexus {
  url: string

  constructor(url: string) {
    this.url = url
  }

  channel(handler: NexusHandler, opts?: NexusWebsocketOptions): NexusChannel {
    const url = new URL(this.url)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/channel'
    return new NexusChannel(url.toString(), handler, opts)
  }

  async addRepos(dids: string[]) {
    const response = await fetch(`${this.url}/add-repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dids }),
    })

    if (!response.ok) {
      throw new Error(`Failed to add repos: ${response.statusText}`)
    }

    return response.json()
  }

  async removeRepos(dids: string[]) {
    const response = await fetch(`${this.url}/remove-repos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dids }),
    })

    if (!response.ok) {
      throw new Error(`Failed to remove repos: ${response.statusText}`)
    }

    return response.json()
  }
}
