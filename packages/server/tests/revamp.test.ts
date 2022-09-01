import axios from 'axios'
const url = 'http://localhost:2583/.adx/v1'

const aliceDid = `did:example:alice`
const bobDid = `did:example:bob`

describe('server', () => {
  it('register', async () => {
    await axios.post(`${url}/account`, { username: 'alice' })
    await axios.post(`${url}/account`, { username: 'bob' })
    expect(true)
  })

  it('makes a post', async () => {
    await axios.post(`${url}/api/repo/${aliceDid}`, {
      writes: [
        {
          action: 'create',
          collection: 'bsky/posts',
          value: {
            $type: 'blueskyweb.xyz:Post',
            text: 'hey there',
            createdAt: new Date().toISOString(),
          },
        },
      ],
    })
  })

  it('retreives posts', async () => {
    const res = await axios.get(`${url}/api/repo/${aliceDid}/c/bsky/posts`)
    console.log(res.data)
  })
})
