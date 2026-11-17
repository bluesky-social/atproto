import { describe, expect, it } from 'vitest'
import { ui8Concat } from '@atproto/lex-data'
import { type StarPair, readStar } from '@atproto/star'
import { RepoCommit } from '../repo-commit.js'
import { serializeRecord, writeRepoStar } from './provider.js'

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

// In path order: likes sort before posts.
const records = await Promise.all([
  serializeRecord('app.bsky.feed.like', '3kbcq3p7ad403', { subject: 'at://x' }),
  serializeRecord('app.bsky.feed.post', '3kbcq3p7ad401', { text: 'hello' }),
])

const commit = RepoCommit.fromRecords(records).toCommit({
  space: 'at://did:example:space/space/app.bsky.group/test',
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad42b',
})

describe(writeRepoStar, () => {
  it('writes the commit as metadata, then one pair per record in path order', async () => {
    const star = await collect(writeRepoStar(commit, records))
    await using reader = await readStar([star])
    const pairs: StarPair[] = []
    for await (const pair of reader.pairs) pairs.push(pair)

    expect(reader.meta).toEqual({ $type: 'atproto-space-repo', ...commit })
    expect(pairs).toEqual(
      records.map((r) => ({
        key: new TextEncoder().encode(`${r.collection}/${r.rkey}`),
        value: r.bytes,
      })),
    )
  })

  it('refuses records out of path order', async () => {
    await expect(
      collect(writeRepoStar(commit, [records[1], records[0]])),
    ).rejects.toThrow(
      /records out of order at app.bsky.feed.like\/3kbcq3p7ad403/,
    )
  })
})
