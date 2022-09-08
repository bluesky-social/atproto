import { AdxUri } from '@adxp/common'
import { AdxClient, AdxPdsClient, AdxRepoClient } from '@adxp/api'
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
import { schemas } from './schemas/defs'

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
  public client: AdxClient
  public pds: AdxPdsClient
  public repo: AdxRepoClient

  constructor(public pdsUrl: string, public did: string) {
    this.client = new AdxClient({
      pds: pdsUrl,
      schemas,
    })
    this.pds = this.client.mainPds
    this.repo = this.client.repo(did)
  }

  config() {
    return {
      headers: {
        Authorization: this.did,
      },
    }
  }

  async register(username: string) {
    await this.pds.registerRepo({ username, did: this.did })
  }

  async createProfile(
    displayName: string,
    description?: string,
  ): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/profile')
      .create('blueskyweb.xyz:Profile', {
        $type: 'blueskyweb.xyz:Profile',
        displayName,
        description,
      })
    return uri
  }

  async createPost(text: string): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/posts')
      .create('blueskyweb.xyz:Post', {
        $type: 'blueskyweb.xyz:Post',
        text,
        createdAt: new Date().toISOString(),
      })
    return uri
  }

  async reply(root: AdxUri, parent: AdxUri, text: string): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/posts')
      .create('blueskyweb.xyz:Post', {
        $type: 'blueskyweb.xyz:Post',
        text,
        reply: {
          root: root.toString(),
          parent: parent.toString(),
        },
        createdAt: new Date().toISOString(),
      })
    return uri
  }

  // async listPosts(did: string = this.did): Promise<Post.Record[]> {
  //   const res = await axios.get(
  //     `${this.api}/api/repo/${did}/c/bsky/posts`,
  //     this.config(),
  //   )
  //   return res.data
  // }

  async likePost(uri: AdxUri): Promise<AdxUri> {
    const likeUri = await this.repo
      .collection('bsky/likes')
      .create('blueskyweb.xyz:Like', {
        $type: 'blueskyweb.xyz:Like',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
      })
    return likeUri
  }

  async repost(uri: AdxUri): Promise<AdxUri> {
    const repostUri = await this.repo
      .collection('bsky/reposts')
      .create('blueskyweb.xyz:Repost', {
        $type: 'blueskyweb.xyz:Repost',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
      })
    return repostUri
  }

  async followUser(did: string): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/follows')
      .create('blueskyweb.xyz:Follow', {
        $type: 'blueskyweb.xyz:Follow',
        subject: {
          did,
        },
        createdAt: new Date().toISOString(),
      })
    return uri
  }

  async giveBadge(did: string, type: string, tag?: string): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/badges')
      .create('blueskyweb.xyz:Badge', {
        $type: 'blueskyweb.xyz:Badge',
        assertion: {
          type,
          tag,
        },
        subject: {
          did,
        },
        createdAt: new Date().toISOString(),
      })
    return uri
  }

  async likedByView(
    uri: AdxUri,
    limit?: number,
    before?: string,
  ): Promise<LikedByView.Response> {
    return this.pds.view('blueskyweb.xyz:LikedByView', this.did, {
      uri: uri.toString(),
      limit,
      before,
    })
  }

  async repostedByView(
    uri: AdxUri,
    limit?: number,
    before?: string,
  ): Promise<RepostedByView.Response> {
    return this.pds.view('blueskyweb.xyz:RepostedByView', this.did, {
      uri: uri.toString(),
      limit,
      before,
    })
  }

  async userFollowsView(
    user: string,
    limit?: string,
    before?: string,
  ): Promise<UserFollowsView.Response> {
    return this.pds.view('blueskyweb.xyz:UserFollowsView', this.did, {
      user,
      limit,
      before,
    })
  }

  async userFollowersView(
    user: string,
    limit?: number,
    before?: string,
  ): Promise<UserFollowersView.Response> {
    return this.pds.view('blueskyweb.xyz:UserFollowersView', this.did, {
      user,
      limit,
      before,
    })
  }

  async profileView(user: string): Promise<ProfileView.Response> {
    return this.pds.view('blueskyweb.xyz:ProfileView', this.did, {
      user,
    })
  }

  async feedView(limit?: number, before?: string): Promise<FeedView.Response> {
    return this.pds.view('blueskyweb.xyz:FeedView', this.did, {
      limit,
      before,
    })
  }

  async userFeedView(
    user: string,
    limit?: number,
    before?: string,
  ): Promise<FeedView.Response> {
    return this.pds.view('blueskyweb.xyz:FeedView', this.did, {
      user,
      limit,
      before,
    })
  }

  async postThreadView(
    uri: AdxUri,
    depth?: number,
  ): Promise<PostThreadView.Post> {
    return this.pds.view('blueskyweb.xyz:PostThreadView', this.did, {
      uri: uri.toString(),
      depth,
    })
  }
}

export default MicroblogClient
