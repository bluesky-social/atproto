import { Labeled, LikedByView, Post } from '@adxp/microblog'
import axios from 'axios'

const makeViewQueryStr = (params: Record<string, string | number>) => {
  const strs = Object.entries(params).map((entry) => {
    return `${entry[0]}=${encodeURIComponent(entry[1])}`
  })
  return strs.join('&')
}

export class MicroblogClient {
  public api: string
  constructor(public pds: string, public did: string) {
    this.api = `${pds}/.adx/v1`
  }

  async register(username: string) {
    await axios.post(`${this.api}/account`, { username })
  }

  async createProfile(displayName: string, description?: string) {
    await axios.post(`${this.api}/api/repo/${this.did}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/profile',
          value: {
            $type: 'blueskyweb.xyz:Profile',
            displayName,
            description,
          },
        },
      ],
    })
  }

  async createPost(text: string) {
    await axios.post(`${this.api}/api/repo/${this.did}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/posts',
          value: {
            $type: 'blueskyweb.xyz:Post',
            text,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    })
  }

  async listPosts(did: string = this.did): Promise<Labeled<Post.Record>[]> {
    const res = await axios.get(`${this.api}/api/repo/${did}/c/bsky/posts`)
    return res.data
  }

  async likePost(uri: string) {
    await axios.post(`${this.api}/api/repo/${this.did}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/likes',
          value: {
            $type: 'blueskyweb.xyz:Like',
            subject: uri,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    })
  }

  async followUser(did: string) {
    await axios.post(`${this.api}/api/repo/${this.did}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/follows',
          value: {
            $type: 'blueskyweb.xyz:Follow',
            subject: {
              did,
            },
            createdAt: new Date().toISOString(),
          },
        },
      ],
    })
  }

  async giveBadge(did: string, type: string, tag?: string) {
    await axios.post(`${this.api}/api/repo/${this.did}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/badges',
          value: {
            $type: 'blueskyweb.xyz:Badge',
            assertion: {
              type,
              tag,
            },
            subject: {
              did,
            },
            createdAt: new Date().toISOString(),
          },
        },
      ],
    })
  }

  async getLikesForPost(uri: string): Promise<LikedByView.Response> {
    const qs = makeViewQueryStr({ uri })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:LikedByView?${qs}`,
    )
    return res.data
  }

  async getFollows(user: string): Promise<LikedByView.Response> {
    const qs = makeViewQueryStr({ user })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:UserFollowsView?${qs}`,
    )
    return res.data
  }

  async getFollowers(user: string): Promise<LikedByView.Response> {
    const qs = makeViewQueryStr({ user })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:UserFollowersView?${qs}`,
    )
    return res.data
  }

  async getProfile(user: string): Promise<LikedByView.Response> {
    const qs = makeViewQueryStr({ user })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:ProfileView?${qs}`,
    )
    return res.data
  }
}

export default MicroblogClient
