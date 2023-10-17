import { BskyAgent } from '@atproto/api'

describe('Agent Benchmarks', () => {
  it('Creates new Agent instance 10 times', () => {
    for (let i = 0; i < 10; i++) {
      new BskyAgent({ service: 'https://bsky.social' })
    }
  })
})
