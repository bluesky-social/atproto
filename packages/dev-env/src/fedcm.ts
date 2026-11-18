import console from 'node:console'
import { once } from 'node:events'
import process from 'node:process'
import { request } from 'undici'
import { TestNetworkNoAppView } from './network-no-appview.js'
import { TestPds } from './pds.js'
import { mockMailer } from './util.js'

// @NOTE The FedCM demo runs only a PDS (SQLite) and an in-memory PLC, so it
// needs no Docker. Without an AppView, the example app is told
// `bsky_api_did=none` and skips its Bluesky profile features.
const ACCOUNTS = [
  { handle: 'alice', displayName: 'Alice' },
  { handle: 'bob', displayName: 'Bob' },
  { handle: 'carla', displayName: 'Carla' },
]
// @NOTE The optional second PDS (FEDCM_IDP_ORIGIN_2) demonstrates multiple
// identity providers. A PDS treats every handle under its service handle
// domains as local, so with two PDSes each gets its own subdomain of ".test"
// (the only TLD allowed in development) and handles resolve across them.
const MULTI_PDS_HANDLE_DOMAINS = ['.idp1.test', '.idp2.test'] as const
const SECOND_ACCOUNTS = [
  { handle: 'dan', displayName: 'Dan' },
  { handle: 'erin', displayName: 'Erin' },
]
const PASSWORD = 'hunter2'

function parseIdpOrigin(name: string, value: string | undefined): URL {
  if (!value) {
    throw new Error(
      `${name} is required (for example, https://pds.example.com)`,
    )
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin`)
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
      `${name} must be an HTTPS origin without credentials, a nondefault port, a path, query, or fragment`,
    )
  }

  return url
}

function fedcmConfigUrl(idpOrigin: URL): string {
  return new URL('/oauth/fedcm/config.json', idpOrigin).href
}

function createBrowserExampleUrls(
  idpOrigins: URL[],
  network: TestNetworkNoAppView,
) {
  const url = new URL('http://127.0.0.1:8080')
  url.searchParams.set('env', 'development')
  url.searchParams.set('pds_operator_url', idpOrigins[0].origin)
  url.searchParams.set('plc_directory_url', network.plc.url)
  url.searchParams.set('handle_resolver', network.pds.url)
  url.searchParams.set('bsky_api_did', 'none')
  url.searchParams.set('scope', 'atproto account:email account:status')
  url.searchParams.set('fedcm_provider', fedcmConfigUrl(idpOrigins[0]))

  // Active mode takes exactly one provider: the first PDS.
  const activeUrl = new URL(url)
  activeUrl.searchParams.set('fedcm_mode', 'active')

  // Passive mode with every PDS as a configured provider.
  const passiveUrl = new URL(url)
  for (const origin of idpOrigins.slice(1)) {
    passiveUrl.searchParams.append('fedcm_provider', fedcmConfigUrl(origin))
  }

  // Registered IdP mode: no configured provider, the browser supplies it.
  const registrationUrl = new URL(url)
  registrationUrl.searchParams.delete('fedcm_provider')
  registrationUrl.searchParams.set('fedcm_idp_registration', 'true')

  const authnOnly = (u: URL) => {
    const copy = new URL(u)
    copy.searchParams.set('scope', 'atproto')
    return copy
  }

  return {
    passiveUrl,
    activeUrl,
    registrationUrl,
    passiveAuthnUrl: authnOnly(passiveUrl),
    registrationAuthnUrl: authnOnly(registrationUrl),
  }
}

/**
 * Resolve handles and DIDs across several local PDSes: a handle resolves
 * against the PDS with the longest matching service handle domain, and a PDS
 * endpoint in a DID document maps from its public URL to its local one.
 */
function mockMultiPdsResolvers(pdses: TestPds[]) {
  const domains = pdses
    .flatMap((pds) =>
      pds.ctx.cfg.identity.serviceHandleDomains.map((domain) => ({
        domain,
        pds,
      })),
    )
    .sort((a, b) => b.domain.length - a.domain.length)

  for (const { ctx } of pdses) {
    const { idResolver } = ctx
    const origResolveDid = idResolver.did.resolveNoCache
    idResolver.did.resolveNoCache = async (did: string) => {
      const result = await (origResolveDid.call(
        idResolver.did,
        did,
      ) as ReturnType<typeof origResolveDid>)
      const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
      if (typeof service?.serviceEndpoint === 'string') {
        for (const pds of pdses) {
          service.serviceEndpoint = service.serviceEndpoint.replace(
            pds.ctx.cfg.service.publicUrl,
            pds.url,
          )
        }
      }
      return result
    }

    const origResolveHandleDns = idResolver.handle.resolveDns
    idResolver.handle.resolve = async (handle: string) => {
      const match = domains.find(({ domain }) => handle.endsWith(domain))
      if (!match) return origResolveHandleDns.call(idResolver.handle, handle)

      const url = new URL('/.well-known/atproto-did', match.pds.url)
      try {
        const res = await request(url, { headers: { host: handle } })
        if (res.statusCode !== 200) {
          await res.body.dump()
          return undefined
        }
        return res.body.text()
      } catch {
        return undefined
      }
    }
  }
}

async function createAccounts(
  pds: TestPds,
  accounts: { handle: string; displayName: string }[],
): Promise<string[]> {
  const [domain] = pds.ctx.cfg.identity.serviceHandleDomains
  const handles: string[] = []
  for (const { handle: name, displayName } of accounts) {
    const handle = `${name}${domain}`
    handles.push(handle)
    const agent = pds.getAgent()
    await agent.createAccount({
      handle,
      email: `${name}@test.com`,
      password: PASSWORD,
    })
    await agent.app.bsky.actor.profile.create(
      { repo: agent.assertDid },
      { displayName },
    )
  }
  return handles
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
  const idpOrigin = parseIdpOrigin(
    'FEDCM_IDP_ORIGIN',
    process.env.FEDCM_IDP_ORIGIN,
  )
  const idpOrigin2 = process.env.FEDCM_IDP_ORIGIN_2
    ? parseIdpOrigin('FEDCM_IDP_ORIGIN_2', process.env.FEDCM_IDP_ORIGIN_2)
    : undefined
  if (idpOrigin2 && idpOrigin2.origin === idpOrigin.origin) {
    throw new Error('FEDCM_IDP_ORIGIN_2 must differ from FEDCM_IDP_ORIGIN')
  }
  if (signal.aborted) return

  // No AppView runs, so none is configured: a PDS then resolves non-local
  // handles itself rather than asking an AppView.
  const pdsConfig = {
    oauthFedcmEnabled: true,
    oauthFedcmAllowLoopbackClients: true,
    bskyAppViewUrl: undefined,
    bskyAppViewDid: undefined,
    bskyAppViewCdnUrlPattern: undefined,
    enableDidDocWithSession: false,
  }

  await using network = await TestNetworkNoAppView.create({
    pds: {
      ...pdsConfig,
      port: 2583,
      hostname: idpOrigin.hostname,
      serviceHandleDomains: idpOrigin2
        ? [MULTI_PDS_HANDLE_DOMAINS[0]]
        : ['.test'],
    },
    plc: { port: 2582 },
  })
  await using pds2 = idpOrigin2
    ? await TestPds.create({
        ...pdsConfig,
        port: 2584,
        hostname: idpOrigin2.hostname,
        didPlcUrl: network.plc.url,
        serviceHandleDomains: [MULTI_PDS_HANDLE_DOMAINS[1]],
        serviceName: 'Second development PDS',
        primaryColor: '#3b82f6',
      })
    : undefined

  if (signal.aborted) return

  const pdses = pds2 ? [network.pds, pds2] : [network.pds]
  mockMultiPdsResolvers(pdses)
  for (const pds of pdses) mockMailer(pds)

  console.time('FedCM dev environment is ready')
  const handles = await createAccounts(network.pds, ACCOUNTS)
  const handles2 = pds2 ? await createAccounts(pds2, SECOND_ACCOUNTS) : []
  for (const pds of pdses) await pds.processAll()
  console.timeEnd('FedCM dev environment is ready')

  const idpOrigins = idpOrigin2 ? [idpOrigin, idpOrigin2] : [idpOrigin]
  const urls = createBrowserExampleUrls(idpOrigins, network)

  console.log(`PDS account manager: ${new URL('/account', idpOrigin)}`)
  if (idpOrigin2) {
    console.log(
      `Second PDS account manager: ${new URL('/account', idpOrigin2)}`,
    )
  }
  const providers = idpOrigin2 ? 'both PDSes' : 'the PDS'
  console.log(
    `OAuth browser example (passive FedCM, ${providers}): ${urls.passiveUrl}`,
  )
  console.log(
    `OAuth browser example (passive FedCM, ${providers}, authentication only): ${urls.passiveAuthnUrl}`,
  )
  console.log(
    `OAuth browser example (active FedCM, first PDS): ${urls.activeUrl}`,
  )
  console.log(
    `OAuth browser example (registered IdP, needs chrome://flags/#fedcm-idp-registration and #fedcm-lightweight-mode): ${urls.registrationUrl}`,
  )
  console.log(
    `OAuth browser example (registered IdP, authentication only): ${urls.registrationAuthnUrl}`,
  )
  console.log(`Test accounts: ${handles.join(', ')} (password: ${PASSWORD})`)
  if (pds2) {
    console.log(
      `Second PDS test accounts: ${handles2.join(', ')} (password: ${PASSWORD})`,
    )
  }

  if (!signal.aborted) await once(signal, 'abort')
}

run().catch((err) => {
  abortController.abort(err)
  console.error('Error running FedCM dev environment:', err)
  process.exitCode = 1
})
