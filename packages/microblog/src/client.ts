import { AdxUri } from '@adxp/common'
import { AdxClient, AdxPdsClient, AdxRepoClient } from '@adxp/api'
import {
  Post,
  Profile,
  Like,
  Repost,
  Follow,
  Badge,
  FeedView,
  LikedByView,
  PostThreadView,
  ProfileView,
  RepostedByView,
  UserFollowersView,
  UserFollowsView,
} from '@adxp/microblog'
import { schemas } from './defs'

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
    hardcode: Partial<Profile.Record> = {},
  ): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/profile')
      .create('blueskyweb.xyz:Profile', {
        $type: 'blueskyweb.xyz:Profile',
        displayName,
        description,
        ...hardcode,
      })
    return uri
  }

  async createPost(
    text: string,
    entities?: Post.Entity[],
    hardcode: Partial<Post.Record> = {},
  ): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/posts')
      .create('blueskyweb.xyz:Post', {
        $type: 'blueskyweb.xyz:Post',
        text,
        entities,
        createdAt: new Date().toISOString(),
        ...hardcode,
      })
    return uri
  }

  async reply(
    root: AdxUri,
    parent: AdxUri,
    text: string,
    hardcode: Partial<Post.Record> = {},
  ): Promise<AdxUri> {
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
        ...hardcode,
      })
    return uri
  }

  async likePost(
    uri: AdxUri,
    hardcode: Partial<Like.Record> = {},
  ): Promise<AdxUri> {
    const likeUri = await this.repo
      .collection('bsky/likes')
      .create('blueskyweb.xyz:Like', {
        $type: 'blueskyweb.xyz:Like',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
        ...hardcode,
      })
    return likeUri
  }

  async repost(
    uri: AdxUri,
    hardcode: Partial<Repost.Record> = {},
  ): Promise<AdxUri> {
    const repostUri = await this.repo
      .collection('bsky/reposts')
      .create('blueskyweb.xyz:Repost', {
        $type: 'blueskyweb.xyz:Repost',
        subject: uri.toString(),
        createdAt: new Date().toISOString(),
        ...hardcode,
      })
    return repostUri
  }

  async followUser(
    did: string,
    hardcode: Partial<Follow.Record> = {},
  ): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/follows')
      .create('blueskyweb.xyz:Follow', {
        $type: 'blueskyweb.xyz:Follow',
        subject: did,
        createdAt: new Date().toISOString(),
        ...hardcode,
      })
    return uri
  }

  async giveBadge(
    did: string,
    type: string,
    tag?: string,
    hardcode: Partial<Badge.Record> = {},
  ): Promise<AdxUri> {
    const uri = await this.repo
      .collection('bsky/badges')
      .create('blueskyweb.xyz:Badge', {
        $type: 'blueskyweb.xyz:Badge',
        assertion: {
          type,
          tag,
        },
        subject: did,
        createdAt: new Date().toISOString(),
        ...hardcode,
      })
    return uri
  }

  async acceptBadge(badgeUri: AdxUri): Promise<AdxUri> {
    const profiles = await this.repo
      .collection('bsky/profile')
      .list('blueskyweb.xyz:Profile')
    // find the first valid profile
    const found = profiles.records.find((row) => row.valid)
    if (!found) {
      throw new Error('Could not accept badge')
    }
    const recordKey = new AdxUri(found.uri).recordKey
    const profile: Profile.Record = found.value
    const uri = await this.repo
      .collection('bsky/profile')
      .put('blueskyweb.xyz:Profile', recordKey, {
        ...profile,
        badges: [...(profile.badges || []), { uri: badgeUri.toString() }],
      })
    return uri
  }

  async deleteObject(uri: AdxUri): Promise<void> {
    await this.repo.collection(uri.collection).del(uri.recordKey)
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

  async feedView(
    limit?: number,
    before?: string,
  ): Promise<FeedView.FeedItem[]> {
    const view = await this.pds.view('blueskyweb.xyz:FeedView', this.did, {
      limit,
      before,
    })
    return view.feed
  }

  async userFeedView(
    author: string,
    limit?: number,
    before?: string,
  ): Promise<FeedView.FeedItem[]> {
    const view = await this.pds.view('blueskyweb.xyz:FeedView', this.did, {
      author,
      limit,
      before,
    })
    return view.feed
  }

  async postThreadView(
    uri: AdxUri,
    depth?: number,
  ): Promise<PostThreadView.Post> {
    const view = await this.pds.view(
      'blueskyweb.xyz:PostThreadView',
      this.did,
      {
        uri: uri.toString(),
        depth,
      },
    )
    return view.thread
  }
}

export default MicroblogClient
