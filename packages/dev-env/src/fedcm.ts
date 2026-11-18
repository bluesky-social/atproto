import console from 'node:console'
import { once } from 'node:events'
import process from 'node:process'
import { TestNetworkNoAppView } from './network-no-appview.js'
import { mockMailer } from './util.js'

// @NOTE The FedCM demo runs only a PDS (SQLite) and an in-memory PLC, so it
// needs no Docker. Without an AppView, the example app is told
// `bsky_api_did=none` and skips its Bluesky profile features.
const ACCOUNTS = [
  { handle: 'alice.test', displayName: 'Alice' },
  { handle: 'bob.test', displayName: 'Bob' },
  { handle: 'carla.test', displayName: 'Carla' },
]
const PASSWORD = 'hunter2'

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

function createBrowserExampleUrls(
  idpOrigin: URL,
  network: TestNetworkNoAppView,
) {
  const url = new URL('http://127.0.0.1:8080')
  url.searchParams.set('env', 'development')
  url.searchParams.set('pds_operator_url', idpOrigin.origin)
  url.searchParams.set('plc_directory_url', network.plc.url)
  url.searchParams.set('handle_resolver', network.pds.url)
  url.searchParams.set('bsky_api_did', 'none')
  url.searchParams.set('scope', 'atproto account:email account:status')
  url.searchParams.set(
    'fedcm_provider',
    new URL('/oauth/fedcm/config.json', idpOrigin).href,
  )

  const activeUrl = new URL(url)
  activeUrl.searchParams.set('fedcm_mode', 'active')

  // Registered IdP mode: no configured provider, the browser supplies it.
  const registrationUrl = new URL(url)
  registrationUrl.searchParams.delete('fedcm_provider')
  registrationUrl.searchParams.set('fedcm_idp_registration', 'true')

  return { passiveUrl: url, activeUrl, registrationUrl }
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

  await using network = await TestNetworkNoAppView.create({
    pds: {
      port: 2583,
      hostname: idpOrigin.hostname,
      oauthFedcmEnabled: true,
      oauthFedcmAllowLoopbackClients: true,
      bskyAppViewCdnUrlPattern: undefined,
      enableDidDocWithSession: false,
    },
    plc: { port: 2582 },
  })

  if (signal.aborted) return

  mockMailer(network.pds)
  console.time('FedCM dev environment is ready')
  for (const { handle, displayName } of ACCOUNTS) {
    const agent = network.pds.getAgent()
    await agent.createAccount({
      handle,
      email: `${handle.split('.')[0]}@test.com`,
      password: PASSWORD,
    })
    await agent.app.bsky.actor.profile.create(
      { repo: agent.assertDid },
      { displayName },
    )
  }
  await network.processAll()
  console.timeEnd('FedCM dev environment is ready')

  const { passiveUrl, activeUrl, registrationUrl } = createBrowserExampleUrls(
    idpOrigin,
    network,
  )

  console.log(`PDS account manager: ${new URL('/account', idpOrigin)}`)
  console.log(`OAuth browser example (passive FedCM): ${passiveUrl}`)
  console.log(`OAuth browser example (active FedCM): ${activeUrl}`)
  console.log(
    `OAuth browser example (registered IdP, needs chrome://flags/#fedcm-idp-registration and #fedcm-lightweight-mode): ${registrationUrl}`,
  )
  console.log(
    `Test accounts: ${ACCOUNTS.map((a) => a.handle).join(', ')} (password: ${PASSWORD})`,
  )

  if (!signal.aborted) await once(signal, 'abort')
}

run().catch((err) => {
  abortController.abort(err)
  console.error('Error running FedCM dev environment:', err)
  process.exitCode = 1
})
