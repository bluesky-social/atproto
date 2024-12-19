import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import {
  Options,
  createImageProcessor,
  createImageUpscaler,
  getInfo,
} from '../../src/image/sharp'

describe('sharp image processor', () => {
  it('scales up to cover.', async () => {
    const result = await processFixture('key-landscape-small.jpg', {
      format: 'jpeg',
      fit: 'cover',
      width: 500,
      height: 500,
      min: true,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 500,
        width: 500,
      }),
    )
  })

  it('scales up to inside (landscape).', async () => {
    const result = await processFixture('key-landscape-small.jpg', {
      format: 'jpeg',
      fit: 'inside',
      width: 500,
      height: 500,
      min: true,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 290,
        width: 500,
      }),
    )
  })

  it('scales up to inside (portrait).', async () => {
    const result = await processFixture('key-portrait-small.jpg', {
      format: 'jpeg',
      fit: 'inside',
      width: 500,
      height: 500,
      min: true,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 500,
        width: 290,
      }),
    )
  })

  it('scales up to min.', async () => {
    const result = await processFixture('key-landscape-small.jpg', {
      format: 'jpeg',
      width: 500,
      height: 500,
      min: { height: 200, width: 200 },
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 200,
        width: 345,
      }),
    )
  })

  it('does not scale image up when min is false.', async () => {
    const result = await processFixture('key-landscape-small.jpg', {
      format: 'jpeg',
      width: 500,
      height: 500,
      min: false,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 87,
        width: 150,
        mime: 'image/jpeg',
      }),
    )
  })

  it('scales down to cover.', async () => {
    const result = await processFixture('key-landscape-large.jpg', {
      format: 'jpeg',
      fit: 'cover',
      width: 500,
      height: 500,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 500,
        width: 500,
      }),
    )
  })

  it('scales down to inside (landscape).', async () => {
    const result = await processFixture('key-landscape-large.jpg', {
      format: 'jpeg',
      fit: 'inside',
      width: 500,
      height: 500,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 290,
        width: 500,
      }),
    )
  })

  it('scales down to inside (portrait).', async () => {
    const result = await processFixture('key-portrait-large.jpg', {
      format: 'jpeg',
      fit: 'inside',
      width: 500,
      height: 500,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 500,
        width: 290,
      }),
    )
  })

  it('converts jpeg to png.', async () => {
    const result = await processFixture('key-landscape-small.jpg', {
      format: 'png',
      width: 500,
      height: 500,
      min: false,
    })
    expect(result).toEqual(
      expect.objectContaining({
        height: 87,
        width: 150,
        size: expect.any(Number),
        mime: 'image/png',
      }),
    )
  })

  it('controls quality (jpeg).', async () => {
    const high = await processFixture('key-portrait-small.jpg', {
      format: 'jpeg',
      width: 500,
      height: 500,
      quality: 90,
    })
    const low = await processFixture('key-portrait-small.jpg', {
      format: 'jpeg',
      width: 500,
      height: 500,
      quality: 10,
    })
    expect(high.size).toBeGreaterThan(1000)
    expect(low.size).toBeLessThan(1000)
  })

  it('controls quality (png).', async () => {
    const high = await processFixture('key-portrait-small.jpg', {
      format: 'png',
      width: 500,
      height: 500,
      quality: 80,
    })
    const low = await processFixture('key-portrait-small.jpg', {
      format: 'png',
      width: 500,
      height: 500,
      quality: 10,
    })
    expect(high.size).toBeGreaterThan(3000)
    expect(low.size).toBeLessThan(3000)
  })

  async function processFixture(fixture: string, options: Options) {
    const image = createReadStream(`../dev-env/assets/${fixture}`)
    const upscaler = createImageUpscaler(options)
    const processor = createImageProcessor(options)

    const [info] = await Promise.all([
      getInfo(processor),
      pipeline([image, upscaler, processor]),
    ])

    return info
  }
})
