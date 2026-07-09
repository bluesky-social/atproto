#!/usr/bin/env node
/**
 * Full working example: post to Bluesky with clickable hashtags, links, and mentions.
 *
 * The key idea: Bluesky does NOT parse your post text. Clickable #tags, URLs, and
 * @mentions come from a separate `facets` array on the record, which the CLIENT must
 * generate. RichText.detectFacets() does exactly that (and resolves @handles -> DIDs).
 *
 * Setup:
 *   npm init -y
 *   npm install @atproto/api
 *   # package.json needs:  "type": "module"   (or name this file .mjs, as it is)
 *
 * Run (use an App Password, NOT your main password — Settings -> App Passwords):
 *   BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *     node bsky-post-with-facets.mjs
 *
 *   # Optional overrides:
 *   BSKY_SERVICE=https://bsky.social   (default)
 *   BSKY_TEXT="Your custom post with #tags, https://example.com and @someone.bsky.social"
 */

import { AtpAgent } from '@atproto/api'
import { buildPostRecord } from './facets.mjs'

const {
  BSKY_SERVICE = 'https://bsky.social',
  BSKY_HANDLE,
  BSKY_APP_PASSWORD,
  BSKY_TEXT,
} = process.env

if (!BSKY_HANDLE || !BSKY_APP_PASSWORD) {
  console.error(
    'Missing credentials. Set BSKY_HANDLE and BSKY_APP_PASSWORD (an App Password).',
  )
  process.exit(1)
}

const text =
  BSKY_TEXT ??
  'Testing the API with a #hashtag, a link to https://atproto.com, and a mention of @bsky.app 🚀'

async function main() {
  // 1. Log in
  const agent = new AtpAgent({ service: BSKY_SERVICE })
  await agent.login({ identifier: BSKY_HANDLE, password: BSKY_APP_PASSWORD })
  console.log(`Logged in as ${agent.session?.handle} (${agent.session?.did})`)

  // 2. Build the post record with facets, using the reusable helper in ./facets.mjs
  //    (which wraps RichText.detectFacets + mention resolution).
  const record = await buildPostRecord(agent, text)

  // 3. Show what the CLIENT computed — this is the piece a raw createRecord call omits.
  console.log('\nText:', record.text)
  console.log('Detected facets:', JSON.stringify(record.facets ?? [], null, 2))
  if (!record.facets?.length) {
    console.log(
      '(No facets detected — the post would render as plain, unclickable text.)',
    )
  }

  // 4. Create the post WITH facets. Without `facets`, tags/links/mentions are plain text.
  const res = await agent.post(record)

  // 5. Print a link to the created post.
  const rkey = res.uri.split('/').pop()
  console.log('\nPosted!')
  console.log('  AT URI:', res.uri)
  console.log('  CID   :', res.cid)
  console.log(
    `  Web   : https://bsky.app/profile/${agent.session?.handle}/post/${rkey}`,
  )
}

main().catch((err) => {
  console.error('\nFailed:', err?.message ?? err)
  process.exit(1)
})
