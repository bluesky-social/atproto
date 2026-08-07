import { ServerConfig } from '../../src/config'
import { CdnUriBuilder } from '../../src/views/uri'

const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
const cid = 'bafkreibm6jg3ux5qux2m7g5w4hfuaf2mp4xg6t4n2v5x6iiys5ndq4nohq'
const mediaUrl = `https://media.example/v1/media/${encodeURIComponent(did)}/${cid}`

describe('CdnUriBuilder', () => {
  const builder = new CdnUriBuilder({
    cdnUrl: 'https://media.example',
    videoPlaylistUrlPattern: 'https://legacy.invalid/%s/%s/playlist.m3u8',
    videoThumbnailUrlPattern: 'https://legacy.invalid/%s/%s/thumbnail.jpg',
  })

  it('uses the raw gateway route for all images', () => {
    expect(builder.avatar(did, cid)).toBe(mediaUrl)
    expect(builder.banner(did, cid)).toBe(mediaUrl)
    expect(builder.feedThumbnail(did, cid)).toBe(mediaUrl)
    expect(builder.feedFullsize(did, cid)).toBe(mediaUrl)
  })

  it('uses the raw gateway route for videos and their thumbnails', () => {
    expect(builder.videoPlaylist(did, cid)).toBe(mediaUrl)
    expect(builder.videoThumbnail(did, cid)).toBe(mediaUrl)
  })

  it('builds mirrored HLS master URLs under /v1/hls', () => {
    expect(builder.videoHlsMaster(did, cid)).toBe(
      `https://media.example/v1/hls/${encodeURIComponent(did)}/${cid}/master.m3u8`,
    )
  })
})

describe('ServerConfig media gateway URL', () => {
  const values = {
    serverDid: 'did:plc:appview',
    alternateAudienceDids: [],
    dataplaneUrl: 'http://localhost:3001',
    didPlcUrl: 'http://localhost:2582',
    adminPasswords: [],
  }

  it('removes trailing slashes', () => {
    const config = new ServerConfig({
      ...values,
      cdnUrl: '  https://media.example///  ',
    })
    expect(config.cdnUrl).toBe('https://media.example')
  })

  it('retains the development fallback', () => {
    const config = new ServerConfig({
      ...values,
      publicUrl: 'http://localhost:3000/',
    })
    expect(config.cdnUrl).toBe('http://localhost:3000/cdn')
  })

  it('requires an explicit HTTPS gateway URL in production', () => {
    expect(
      () =>
        new ServerConfig({
          ...values,
          environment: 'production',
        }).cdnUrl,
    ).toThrow('cdnUrl is required in production')
    expect(
      () =>
        new ServerConfig({
          ...values,
          environment: 'production',
          cdnUrl: 'http://media.example',
        }).cdnUrl,
    ).toThrow('cdnUrl must use HTTPS in production')
    expect(
      () =>
        new ServerConfig({
          ...values,
          environment: 'production',
          cdnUrl: 'https://localhost:8787',
        }).cdnUrl,
    ).toThrow('cdnUrl must use a public host in production')
  })
})
