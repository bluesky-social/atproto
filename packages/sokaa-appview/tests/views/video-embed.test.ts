import { CdnUriBuilder } from '../../src/views/uri'
import { buildVideoEmbedView } from '../../src/views/video-embed'

const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
const cid = 'bafkreibm6jg3ux5qux2m7g5w4hfuaf2mp4xg6t4n2v5x6iiys5ndq4nohq'
const thumb = 'bafkreibaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('buildVideoEmbedView', () => {
  const cdn = new CdnUriBuilder({
    cdnUrl: 'https://media.example',
    videoPlaylistUrlPattern: 'unused',
    videoThumbnailUrlPattern: 'unused',
  })

  it('defaults missing assets to processing with no playlist', () => {
    const view = buildVideoEmbedView({
      authorDid: did,
      videoCid: cid,
      thumbCid: thumb,
      cdn,
    })
    expect(view.state).toBe('processing')
    expect(view.playlist).toBeUndefined()
    expect(view.thumbnail).toBe(
      `https://media.example/v1/media/${encodeURIComponent(did)}/${thumb}`,
    )
  })

  it('does not emit playlist while processing even if a URL is present', () => {
    const view = buildVideoEmbedView({
      authorDid: did,
      videoCid: cid,
      cdn,
      asset: {
        state: 'processing',
        playlistUrl: 'https://stream.example/uid/manifest/video.m3u8',
      },
    })
    expect(view.state).toBe('processing')
    expect(view.playlist).toBeUndefined()
  })

  it('emits playlist only when ready with a playlist URL', () => {
    const playlist = 'https://stream.example/uid/manifest/video.m3u8'
    const view = buildVideoEmbedView({
      authorDid: did,
      videoCid: cid,
      cdn,
      asset: { state: 'ready', playlistUrl: playlist },
    })
    expect(view.state).toBe('ready')
    expect(view.playlist).toBe(playlist)
  })

  it('never treats raw media-gateway MP4 as a ready playlist', () => {
    const rawMp4 = `https://media.example/v1/media/${encodeURIComponent(did)}/${cid}`
    const view = buildVideoEmbedView({
      authorDid: did,
      videoCid: cid,
      cdn,
      asset: { state: 'ready', playlistUrl: undefined },
    })
    expect(view.playlist).toBeUndefined()
    // Hydration helper itself must not invent the raw MP4 URL.
    expect(view.playlist).not.toBe(rawMp4)
  })

  it('includes a client-safe error category when failed', () => {
    const view = buildVideoEmbedView({
      authorDid: did,
      videoCid: cid,
      cdn,
      asset: { state: 'failed', error: 'InvalidSource' },
    })
    expect(view.state).toBe('failed')
    expect(view.playlist).toBeUndefined()
    expect(view.error).toBe('InvalidSource')
  })
})
