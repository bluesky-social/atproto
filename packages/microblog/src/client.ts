import { AdxUri } from '@adxp/common'
import {
  FeedView,
  LikedByView,
  Post,
  PostThreadView,
  ProfileView,
  RepostedByView,
  UserFollowersView,
  UserFollowsView,
} from '@adxp/microblog'
import axios from 'axios'

const makeViewQueryStr = (
  params: Record<string, string | number | undefined>,
) => {
  const strs: string[] = []
  for (const entry of Object.entries(params)) {
    if (entry[1] !== undefined) {
      strs.push(`${entry[0]}=${encodeURIComponent(entry[1])}`)
    }
  }
  return strs.join('&')
}

export class MicroblogClient {
  public api: string
  constructor(public pds: string, public did: string) {
    this.api = `${pds}/.adx/v1`
  }

  config() {
    return {
      headers: {
        Authorization: this.did,
      },
    }
  }

  async register(username: string) {
    await axios.post(`${this.api}/account`, { username })
  }

  async createProfile(
    displayName: string,
    description?: string,
  ): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/profile`,
      {
        $type: 'blueskyweb.xyz:Profile',
        displayName,
        description,
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async createPost(text: string): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/posts`,
      {
        $type: 'blueskyweb.xyz:Post',
        text,
        createdAt: new Date().toISOString(),
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async reply(root: AdxUri, parent: AdxUri, text: string): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/posts`,
      {
        $type: 'blueskyweb.xyz:Post',
        text,
        reply: {
          root: root.toString(),
          parent: parent.toString(),
        },
        createdAt: new Date().toISOString(),
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async listPosts(did: string = this.did): Promise<Post.Record[]> {
    const res = await axios.get(
      `${this.api}/api/repo/${did}/c/bsky/posts`,
      this.config(),
    )
    return res.data
  }

  async likePost(uri: AdxUri): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/likes`,
      {
        $type: 'blueskyweb.xyz:Like',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async repost(uri: AdxUri): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/reposts`,
      {
        $type: 'blueskyweb.xyz:Repost',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async followUser(did: string): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/follows`,
      {
        $type: 'blueskyweb.xyz:Follow',
        subject: {
          did,
        },
        createdAt: new Date().toISOString(),
      },
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async giveBadge(did: string, type: string, tag?: string): Promise<AdxUri> {
    const res = await axios.post(
      `${this.api}/api/repo/${this.did}/c/bsky/badges`,
      {
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
      this.config(),
    )
    return new AdxUri(res.data.uri)
  }

  async getLikedBy(
    uri: string,
    limit?: number,
    before?: string,
  ): Promise<LikedByView.Response> {
    const qs = makeViewQueryStr({ uri, limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:LikedByView?${qs}`,
      this.config(),
    )
    return res.data
  }

  async getRepostedBy(
    uri: string,
    limit?: number,
    before?: string,
  ): Promise<RepostedByView.Response> {
    const qs = makeViewQueryStr({ uri, limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:RepostedByView?${qs}`,
      this.config(),
    )
    return res.data
  }

  async getFollows(
    user: string,
    limit?: string,
    before?: string,
  ): Promise<UserFollowsView.Response> {
    const qs = makeViewQueryStr({ user, limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:UserFollowsView?${qs}`,
      this.config(),
    )
    return res.data
  }

  async getFollowers(
    user: string,
    limit?: number,
    before?: string,
  ): Promise<UserFollowersView.Response> {
    const qs = makeViewQueryStr({ user, limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:UserFollowersView?${qs}`,
      this.config(),
    )
    return res.data
  }

  async getProfile(user: string): Promise<ProfileView.Response> {
    const qs = makeViewQueryStr({ user })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:ProfileView?${qs}`,
      this.config(),
    )
    return res.data
  }

  async getFeed(limit?: number, before?: string): Promise<FeedView.FeedItem[]> {
    const qs = makeViewQueryStr({ limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:FeedView${qs}`,
      this.config(),
    )
    return res.data
  }

  async getUserFeed(
    user: string,
    limit?: number,
    before?: string,
  ): Promise<FeedView.FeedItem[]> {
    const qs = makeViewQueryStr({ user, limit, before })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:FeedView?${qs}`,
      this.config(),
    )
    return res.data.feed
  }

  async getPostThread(
    uri: AdxUri,
    depth?: number,
  ): Promise<PostThreadView.Post> {
    const qs = makeViewQueryStr({ uri: uri.toString(), depth })
    const res = await axios.get(
      `${this.api}/api/view/blueskyweb.xyz:PostThreadView?${qs}`,
      this.config(),
    )
    return res.data.thread
  }
}

export default MicroblogClient
