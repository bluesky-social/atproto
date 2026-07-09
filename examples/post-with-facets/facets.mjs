/**
 * Reusable client-side helper: turn plain post text into a post record whose
 * #hashtags, links, and @mentions are clickable.
 *
 * Bluesky stores post `text` verbatim and never parses it — the clickable parts
 * come from a `facets` array the client must attach. These helpers wrap
 * `RichText.detectFacets`, which computes the byte-range facets and resolves
 * @handles to DIDs. Import them into your own app.
 *
 *   import { buildPostRecord, postWithFacets } from './facets.mjs'
 *
 *   // build a record you can inspect / augment before writing:
 *   const record = await buildPostRecord(agent, 'Hello #world https://example.com')
 *   await agent.post(record)
 *
 *   // or one-shot create:
 *   const res = await postWithFacets(agent, 'Hello #world https://example.com')
 */

import { RichText } from '@atproto/api'

/**
 * Build an `app.bsky.feed.post` record with facets detected from the text.
 *
 * @param {import('@atproto/api').AtpAgent} agent  logged-in agent (used to resolve mentions)
 * @param {string} text
 * @param {object} [extra]  extra record fields to merge (e.g. { langs, embed, reply })
 * @returns {Promise<object>} a post record: { text, facets, createdAt, ...extra }
 */
export async function buildPostRecord(agent, text, extra = {}) {
  const rt = new RichText({ text })
  await rt.detectFacets(agent) // detect tags/links/mentions + resolve @handle -> DID
  return {
    $type: 'app.bsky.feed.post',
    text: rt.text,
    // omit the key entirely when nothing was detected, rather than sending []
    ...(rt.facets?.length ? { facets: rt.facets } : {}),
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

/**
 * Detect facets and create the post in one call.
 *
 * @param {import('@atproto/api').AtpAgent} agent
 * @param {string} text
 * @param {object} [extra]
 * @returns {Promise<{uri: string, cid: string}>}
 */
export async function postWithFacets(agent, text, extra = {}) {
  const record = await buildPostRecord(agent, text, extra)
  return agent.post(record)
}
