import fs from 'fs/promises'
import { AtUri } from '@atproto/uri'
import AtpAgent, { AppBskyEmbedExternal, BlobRef } from '@waverlyai/atproto-api'
import { CloseFn, runTestServer } from './_util'
import * as Miniblog from '../src/lexicon/types/social/waverly/miniblog'
import { ids } from '../src/lexicon/lexicons'
import { BlobNotFoundError } from '@atproto/repo'
import AppContext from '../src/context'

const loremIpsum =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla vitae arcu ut nulla dictum sagittis. Integer viverra ullamcorper augue vitae gravida. Cras quis mauris ac eros iaculis aliquam. Aliquam sit amet quam vitae turpis vehicula pellentesque sed feugiat turpis. Nam interdum laoreet pulvinar. Nulla eu blandit lectus. Sed quis tortor eget metus vulputate blandit sit amet nec erat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse potenti.' +
  'Praesent sed dui ac tellus congue aliquam vitae eu quam. Nullam vitae ante quis sem semper semper non ac diam. Ut porta justo quis interdum placerat. Aliquam efficitur bibendum leo non condimentum. Fusce ullamcorper ultricies nunc ut ornare. Duis interdum vehicula risus, sit amet porta nunc facilisis ac. Nulla facilisi. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Maecenas molestie justo sed arcu facilisis, et accumsan neque placerat. Ut fringilla vehicula magna, ac pellentesque neque pretium vel.' +
  'Nulla facilisi. Aenean auctor dignissim neque, dapibus vulputate dui semper euismod. Integer ut turpis at urna congue suscipit. Nulla facilisi. Ut sit amet malesuada orci. Aliquam id tellus vel diam luctus pulvinar vel eget felis. Aliquam erat volutpat. Phasellus semper nibh mi, quis laoreet est blandit sit amet. Nulla facilisi. Vivamus semper sem et ligula tincidunt, nec lacinia ex maximus.' +
  'Nunc fringilla gravida diam, ac sollicitudin lacus pharetra id. Fusce imperdiet turpis mauris, eu laoreet enim vulputate luctus. Nulla eu pharetra risus, a dapibus libero. Vestibulum auctor turpis sem, a accumsan metus venenatis at. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Vivamus lorem erat, aliquam ac placerat eget, dapibus id urna. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec hendrerit magna vel lacus varius, a consequat neque tempor. Vestibulum rutrum elit nec enim pretium, sed viverra felis molestie. Nunc a urna in nibh molestie tempor nec eget ex. Curabitur condimentum erat libero, quis porta odio malesuada vitae. Integer vulputate purus sed quam convallis, in egestas quam ultricies. Integer interdum posuere elit a tempus. Proin interdum porta viverra. Maecenas condimentum fermentum euismod. Curabitur arcu purus, pellentesque tempor tellus at, dictum faucibus felis.' +
  'Nunc ultricies fermentum faucibus. Nunc ac urna congue mi tristique pharetra at eu eros. Donec ipsum velit, lobortis vel nisl ac, laoreet iaculis tellus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus molestie ipsum tincidunt pulvinar interdum. Aliquam erat volutpat. Cras tempus leo risus, tempus lobortis ex pellentesque et. Etiam convallis lorem elit, eget aliquam dui rhoncus sit amet. In quis euismod elit. Sed ut elit a diam elementum varius semper imperdiet quam. Donec ut hendrerit magna. Mauris ac feugiat urna, ac fermentum felis. Donec nec blandit augue. Pellentesque hendrerit, lorem eget accumsan aliquam, velit turpis laoreet dolor, sit amet cursus enim purus sit amet lectus. Mauris nec tortor turpis.'

const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  did: '',
  password: 'alice-pass',
}

describe('waverly crud operations', () => {
  let ctx: AppContext
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'waverly_crud',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    aliceAgent = new AtpAgent({ service: server.url })
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await agent.api.com.atproto.server.createAccount({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceAgent.api.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
  })

  let uri1: AtUri
  let subjectUri1: AtUri
  it('creates records', async () => {
    const res1 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: 'This is the bluesky post for the miniblog',
        createdAt: new Date().toISOString(),
      },
    })
    subjectUri1 = new AtUri(res1.data.uri)
    const res2 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      record: {
        $type: ids.SocialWaverlyMiniblog,
        text: loremIpsum,
        subject: {
          uri: res1.data.uri.toString(),
          cid: res1.data.cid.toString(),
        },
        createdAt: new Date().toISOString(),
      },
    })
    uri1 = new AtUri(res2.data.uri)
    expect(res2.data.uri).toBe(
      `at://${alice.did}/social.waverly.miniblog/${uri1.rkey}`,
    )
  })

  it('lists records', async () => {
    const res = await agent.api.com.atproto.repo.listRecords({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
    })
    expect(res.data.records.length).toBe(1)
    expect(res.data.records[0].uri).toBe(uri1.toString())
    const value = res.data.records[0].value as Miniblog.Record
    expect(value.text).toBe(loremIpsum)
    expect(value.subject?.uri).toBe(subjectUri1.toString())
  })

  it('gets records', async () => {
    const res = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri1.rkey,
    })
    expect(res.data.uri).toBe(uri1.toString())
    const value = res.data.value as Miniblog.Record
    expect(value.text).toBe(loremIpsum)
    expect(value.subject?.uri).toBe(subjectUri1.toString())
  })

  let uri2: AtUri
  it('creates records without subject', async () => {
    const res1 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      record: {
        $type: ids.SocialWaverlyMiniblog,
        text: loremIpsum,
        createdAt: new Date().toISOString(),
      },
    })
    uri2 = new AtUri(res1.data.uri)
    expect(res1.data.uri).toBe(
      `at://${alice.did}/social.waverly.miniblog/${uri2.rkey}`,
    )
    const res2 = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri2.rkey,
    })
    expect(res2.data.uri).toBe(uri2.toString())
    const value = res2.data.value as Miniblog.Record
    expect(value.text).toBe(loremIpsum)
    expect(value.subject).toBeUndefined()
  })

  it('adds subjects to records', async () => {
    const res1 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: alice.did,
      collection: ids.AppBskyFeedPost,
      record: {
        $type: ids.AppBskyFeedPost,
        text: 'This is the bluesky post for the second miniblog',
        createdAt: new Date().toISOString(),
      },
    })
    const res2 = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri2.rkey,
    })
    const record = res2.data.value as Miniblog.Record
    record.subject = {
      uri: res1.data.uri.toString(),
      cid: res1.data.cid.toString(),
    }
    const res3 = await aliceAgent.api.com.atproto.repo.putRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri2.rkey,
      record,
    })
    expect(res3.data.uri).toBe(uri2.toString())
    const res4 = await agent.api.com.atproto.repo.getRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri2.rkey,
    })
    expect(res4.data.uri).toBe(uri2.toString())
    const value = res4.data.value as Miniblog.Record
    expect(value.text).toBe(loremIpsum)
    expect(value.subject?.uri).toBe(res1.data.uri.toString())
  })

  it('deletes records', async () => {
    await aliceAgent.api.com.atproto.repo.deleteRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri1.rkey,
    })
    await aliceAgent.api.com.atproto.repo.deleteRecord({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
      rkey: uri2.rkey,
    })
    const res1 = await agent.api.com.atproto.repo.listRecords({
      repo: alice.did,
      collection: ids.SocialWaverlyMiniblog,
    })
    expect(res1.data.records.length).toBe(0)
  })

  it('creates records with alternate api', async () => {
    const res = await aliceAgent.api.social.waverly.miniblog.create(
      { repo: alice.did },
      {
        text: loremIpsum,
        createdAt: new Date().toISOString(),
      },
    )
    uri1 = new AtUri(res.uri)
    expect(res.uri).toBe(
      `at://${alice.did}/social.waverly.miniblog/${uri1.rkey}`,
    )
  })

  it('lists records with alternate api', async () => {
    const res = await aliceAgent.api.social.waverly.miniblog.list({
      repo: alice.did,
    })
    expect(res.records.length).toBe(1)
    expect(res.records[0].uri).toBe(uri1.toString())
    expect(res.records[0].value.text).toBe(loremIpsum)
  })

  it('gets records with alternate api', async () => {
    const res = await aliceAgent.api.social.waverly.miniblog.get({
      repo: alice.did,
      rkey: uri1.rkey,
    })
    expect(res.uri).toBe(uri1.toString())
    expect(res.value.text).toBe(loremIpsum)
  })

  it('deletes records with alternate api', async () => {
    await aliceAgent.api.social.waverly.miniblog.delete({
      repo: alice.did,
      rkey: uri1.rkey,
    })
    const res = await aliceAgent.api.social.waverly.miniblog.list({
      repo: alice.did,
    })
    expect(res.records.length).toBe(0)
  })

  it('creates records with image embed', async () => {
    const file = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const uploadedRes = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
      encoding: 'image/jpeg',
    })
    const uploaded = uploadedRes.data.blob
    // Expect blobstore not to have image yet
    await expect(ctx.blobstore.getBytes(uploaded.ref)).rejects.toThrow(
      BlobNotFoundError,
    )
    const res1 = await await aliceAgent.api.social.waverly.miniblog.create(
      { repo: alice.did },
      {
        $type: ids.SocialWaverlyMiniblog,
        text: loremIpsum,
        embed: {
          $type: 'app.bsky.embed.images',
          images: [{ image: uploaded, alt: '' }],
        },
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)
    const res2 = await aliceAgent.api.social.waverly.miniblog.get({
      repo: alice.did,
      rkey: uri.rkey,
    })
    expect(res2.uri).toBe(uri.toString())
    const images = res2.value.embed?.images as { image: BlobRef }[]
    expect(images.length).toEqual(1)
    expect(uploaded.ref.equals(images[0].image.ref)).toBeTruthy()
    // Cleanup
    await aliceAgent.api.social.waverly.miniblog.delete({
      repo: alice.did,
      rkey: uri.rkey,
    })
  })

  it('creates records with link embed', async () => {
    const res1 = await await aliceAgent.api.social.waverly.miniblog.create(
      { repo: alice.did },
      {
        $type: ids.SocialWaverlyMiniblog,
        text: loremIpsum,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://waverly.social',
            title: 'Check out Waverly',
            description: 'Your new favorite social place',
          },
        },
        createdAt: new Date().toISOString(),
      },
    )
    const uri = new AtUri(res1.uri)
    const res2 = await aliceAgent.api.social.waverly.miniblog.get({
      repo: alice.did,
      rkey: uri.rkey,
    })
    expect(res2.uri).toBe(uri.toString())
    const external = res2.value.embed?.external as AppBskyEmbedExternal.External
    expect(external.uri).toBe('https://waverly.social')
    // Cleanup
    await aliceAgent.api.social.waverly.miniblog.delete({
      repo: alice.did,
      rkey: uri.rkey,
    })
  })
})
