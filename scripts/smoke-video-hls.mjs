#!/usr/bin/env node
/**
 * Production / staging smoke for PR 8 HLS contract.
 *
 * Required env:
 *   SOKAA_STREAM_ACCOUNT_ID
 *   SOKAA_STREAM_API_TOKEN
 *   SOKAA_STREAM_CUSTOMER_SUBDOMAIN
 *   SOKAA_APPVIEW_ADMIN_PASSWORD
 *   SOKAA_APPVIEW_URL          (e.g. https://appview.example)
 *   SOKAA_SMOKE_DID
 *   SOKAA_SMOKE_VIDEO_CID
 *   SOKAA_SMOKE_SOURCE_URL     (media-gateway URL for a tiny MP4 fixture)
 *
 * Exits 0 with a skip message when credentials are absent (CI-safe).
 */

const required = [
  'SOKAA_STREAM_ACCOUNT_ID',
  'SOKAA_STREAM_API_TOKEN',
  'SOKAA_STREAM_CUSTOMER_SUBDOMAIN',
  'SOKAA_APPVIEW_ADMIN_PASSWORD',
  'SOKAA_APPVIEW_URL',
  'SOKAA_SMOKE_DID',
  'SOKAA_SMOKE_VIDEO_CID',
  'SOKAA_SMOKE_SOURCE_URL',
]

const missing = required.filter((key) => !process.env[key]?.trim())
if (missing.length) {
  console.log(
    `smoke-video-hls: skipped (missing ${missing.join(', ')}). Configure secrets to run production HLS smoke.`,
  )
  process.exit(0)
}

const appview = process.env.SOKAA_APPVIEW_URL.replace(/\/+$/, '')
const auth =
  'Basic ' +
  Buffer.from(`admin:${process.env.SOKAA_APPVIEW_ADMIN_PASSWORD}`).toString(
    'base64',
  )

const submit = await fetch(`${appview}/_sokaa/video/jobs`, {
  method: 'POST',
  headers: {
    Authorization: auth,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    did: process.env.SOKAA_SMOKE_DID,
    videoCid: process.env.SOKAA_SMOKE_VIDEO_CID,
    sourceUrl: process.env.SOKAA_SMOKE_SOURCE_URL,
  }),
})

if (!submit.ok) {
  console.error('submit failed', submit.status, await submit.text())
  process.exit(1)
}

const job = await submit.json()
console.log('submitted', job)

const deadline = Date.now() + 10 * 60 * 1000
let playlistUrl = job.playlistUrl
while (!playlistUrl && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000))
  // Re-submit is idempotent and refreshes readiness when Stream is done.
  const again = await fetch(`${appview}/_sokaa/video/jobs`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      did: process.env.SOKAA_SMOKE_DID,
      videoCid: process.env.SOKAA_SMOKE_VIDEO_CID,
      sourceUrl: process.env.SOKAA_SMOKE_SOURCE_URL,
    }),
  })
  const body = await again.json()
  if (body.state === 'ready' && body.playlistUrl) {
    playlistUrl = body.playlistUrl
    break
  }
  if (body.state === 'failed') {
    console.error('job failed', body)
    process.exit(1)
  }
  console.log('waiting...', body.state)
}

if (!playlistUrl) {
  console.error('timed out waiting for ready playlist')
  process.exit(1)
}

const master = await fetch(playlistUrl)
if (!master.ok) {
  console.error('master playlist GET failed', master.status)
  process.exit(1)
}
const masterText = await master.text()
const mediaLine = masterText
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => l && !l.startsWith('#'))
if (!mediaLine) {
  console.error('master playlist had no media URI')
  process.exit(1)
}
const mediaUrl = new URL(mediaLine, playlistUrl).toString()
const media = await fetch(mediaUrl)
if (!media.ok) {
  console.error('media playlist/segment GET failed', media.status, mediaUrl)
  process.exit(1)
}

console.log('smoke-video-hls: ok', { playlistUrl, mediaUrl })
