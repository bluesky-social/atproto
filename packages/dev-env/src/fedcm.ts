import console from 'node:console'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import process from 'node:process'
import { generateMockSetup } from './mock/index.js'
import { TestNetwork } from './network.js'
import { mockMailer } from './util.js'

function parseIdpOrigin(value: string | undefined): URL {
  if (!value) {
    throw new Error(
      'FEDCM_IDP_ORIGIN is required (for example, https://pds.example.com)',
    )
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('FEDCM_IDP_ORIGIN must be a valid HTTPS origin')
  }

  if (
    !/^https:\/\/[^/?#]+\/?$/iu.test(value) ||
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'FEDCM_IDP_ORIGIN must be an HTTPS origin without credentials, a nondefault port, a path, query, or fragment',
    )
  }

  return url
}

function createBrowserExampleUrls(idpOrigin: URL, network: TestNetwork) {
  const appViewDid = network.bsky.serverDid
  const url = new URL('http://127.0.0.1:8080')
  url.searchParams.set('env', 'development')
  url.searchParams.set('pds_operator_url', idpOrigin.origin)
  url.searchParams.set('plc_directory_url', network.plc.url)
  url.searchParams.set('handle_resolver', network.pds.url)
  url.searchParams.set('bsky_api_url', network.bsky.url)
  url.searchParams.set('bsky_api_did', appViewDid)
  url.searchParams.set(
    'scope',
    [
      'atproto',
      'account:email',
      'account:status',
      'repo:app.bsky.actor.profile',
      `rpc:app.bsky.actor.getPreferences?aud=${appViewDid}#bsky_appview`,
      `rpc:app.bsky.actor.getProfile?aud=${appViewDid}#bsky_appview`,
    ].join(' '),
  )
  url.searchParams.set(
    'fedcm_provider',
    new URL('/oauth/fedcm/config.json', idpOrigin).href,
  )

  const activeUrl = new URL(url)
  activeUrl.searchParams.set('fedcm_mode', 'active')

  return { passiveUrl: url, activeUrl }
}

const abortController = new AbortController()
const signal = abortController.signal
const onSignal = () => abortController.abort()

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, onSignal)
}
signal.addEventListener(
  'abort',
  () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
  },
  { once: true },
)

async function run() {
  const idpOrigin = parseIdpOrigin(process.env.FEDCM_IDP_ORIGIN)
  if (signal.aborted) return

  // @NOTE Bsync schema names allow letters and underscores only.
  const schemaSuffix = Array.from(randomBytes(12), (byte) =>
    String.fromCharCode(97 + (byte % 26)),
  ).join('')

  await using network = await TestNetwork.create({
    dbPostgresSchema: `fedcm_${schemaSuffix}`,
    pds: {
      port: 2583,
      hostname: idpOrigin.hostname,
      oauthFedcmEnabled: true,
      oauthFedcmAllowLoopbackClients: true,
      bskyAppViewCdnUrlPattern: undefined,
      enableDidDocWithSession: false,
    },
    bsky: {
      port: 2584,
      publicUrl: 'http://localhost:2584',
    },
    plc: { port: 2582 },
    ozone: {
      port: 2587,
      chatUrl: 'http://localhost:2590',
      chatDid: 'did:example:chat',
      dbMaterializedViewRefreshIntervalMs: 30_000,
    },
    introspect: { port: 2581 },
  })

  if (signal.aborted) return

  mockMailer(network.pds)
  console.time('FedCM dev environment is ready')
  await generateMockSetup(network)
  await network.processAll()
  console.timeEnd('FedCM dev environment is ready')

  const { passiveUrl, activeUrl } = createBrowserExampleUrls(idpOrigin, network)

  console.log(`PDS account manager: ${new URL('/account', idpOrigin)}`)
  console.log(`OAuth browser example (passive FedCM): ${passiveUrl}`)
  console.log(`OAuth browser example (active FedCM): ${activeUrl}`)
  console.log(`AppView DID: ${network.bsky.serverDid}`)
  console.log(
    'Test accounts: alice.test, bob.test, carla.test (password: hunter2)',
  )

  if (!signal.aborted) await once(signal, 'abort')
}

run().catch((err) => {
  abortController.abort(err)
  console.error('Error running FedCM dev environment:', err)
  process.exitCode = 1
})
