import { Request } from 'express'
import { AppContext } from '../src/context'
import { ids } from '../src/lexicon/lexicons'
import {
  computeProxyTo,
  parseProxyHeader,
  parseProxyInfo,
} from '../src/pipethrough'

const BSKY = { did: 'did:web:api.bsky.app', url: 'https://api.bsky.app' }
const WSOC = {
  did: 'did:web:appview.wsocial.eu',
  url: 'https://appview.wsocial.eu',
}
const MOD = { did: 'did:plc:modservice', url: 'https://mod.example' }

const noHeaderReq = { header: () => undefined } as unknown as Request

const bskyEndpoint = ids.AppBskyUnspeccedGetSuggestedUsers
const wSocialEndpoint = ids.AppBskyActorGetProfile

type DidDoc = {
  id: string
  service: { id: string; type: string; serviceEndpoint: string }[]
}

const makeDidDoc = (did: string, serviceId: string, endpoint: string): DidDoc => ({
  id: did,
  service: [
    {
      id: serviceId.startsWith('#') ? serviceId : `#${serviceId}`,
      type: 'AtprotoService',
      serviceEndpoint: endpoint,
    },
  ],
})

const makeCtx = (
  overrides: {
    bskyAppView?: typeof BSKY | null
    wsocialAppView?: typeof WSOC | null
    proxyToDisabled?: boolean
    didDocResponse?: DidDoc | null
  } = {},
): AppContext => {
  const resolve = jest.fn().mockResolvedValue(overrides.didDocResponse ?? null)
  const cfg = {
    bskyAppView: 'bskyAppView' in overrides ? overrides.bskyAppView : BSKY,
    wsocialAppView:
      'wsocialAppView' in overrides ? overrides.wsocialAppView : WSOC,
    modService: MOD,
    reportService: MOD,
    service: {
      proxyToDisabled: overrides.proxyToDisabled ?? false,
    },
  }
  return {
    cfg,
    idResolver: { did: { resolve } },
  } as unknown as AppContext
}

const getResolveMock = (ctx: AppContext): jest.Mock =>
  (ctx as unknown as { idResolver: { did: { resolve: jest.Mock } } }).idResolver
    .did.resolve

describe('pipethrough routing', () => {
  describe('computeProxyTo (no header, default service)', () => {
    it('routes eu.wsocial.* to wsocial appview when configured', () => {
      const ctx = makeCtx()
      expect(computeProxyTo(ctx, noHeaderReq, ids.AppBskyActorGetProfile)).toBe(
        `${WSOC.did}#wsocial_appview`,
      )
    })

    it('falls back to bsky appview for eu.wsocial.* when wsocial unconfigured', () => {
      const ctx = makeCtx({ wsocialAppView: null })
      expect(computeProxyTo(ctx, noHeaderReq, wSocialEndpoint)).toBe(
        `${BSKY.did}#bsky_appview`,
      )
    })

    it('routes app.bsky.* to bsky appview', () => {
      const ctx = makeCtx()
      expect(computeProxyTo(ctx, noHeaderReq, bskyEndpoint)).toBe(
        `${BSKY.did}#bsky_appview`,
      )
    })

    it('routes com.atproto.moderation.createReport to report service', () => {
      const ctx = makeCtx()
      expect(
        computeProxyTo(ctx, noHeaderReq, ids.ComAtprotoModerationCreateReport),
      ).toBe(`${MOD.did}#atproto_labeler`)
    })

    it('routes tools.ozone.* to mod service', () => {
      const ctx = makeCtx()
      expect(
        computeProxyTo(ctx, noHeaderReq, ids.ToolsOzoneModerationGetEvent),
      ).toBe(`${MOD.did}#atproto_labeler`)
    })

    it('passes the atproto-proxy header through verbatim when present and proxyToDisabled = false', () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? 'did:plc:custom#custom_svc' : undefined,
      } as unknown as Request
      expect(computeProxyTo(makeCtx(), req, ids.AppBskyActorGetProfile)).toBe(
        'did:plc:custom#custom_svc',
      )
    })

    it('ignores atproto-proxy header and uses default service when proxyToDisabled', () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? 'did:plc:custom#custom_svc' : undefined,
      } as unknown as Request
      expect(
        computeProxyTo(makeCtx({ proxyToDisabled: true }), req, bskyEndpoint),
      ).toBe(`${BSKY.did}#bsky_appview`)
    })

    it('ignores atproto-proxy header and routes eu.wsocial.* to wsocial appview when proxyToDisabled', () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? 'did:plc:custom#custom_svc' : undefined,
      } as unknown as Request
      expect(
        computeProxyTo(
          makeCtx({ proxyToDisabled: true }),
          req,
          wSocialEndpoint,
        ),
      ).toBe(`${WSOC.did}#wsocial_appview`)
    })

    it('throws when proxyToDisabled and no default service is configured (header present)', () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? 'did:plc:custom#custom_svc' : undefined,
      } as unknown as Request
      expect(() =>
        computeProxyTo(
          makeCtx({
            proxyToDisabled: true,
            bskyAppView: null,
            wsocialAppView: null,
          }),
          req,
          wSocialEndpoint,
        ),
      ).toThrow(/No service configured/)
    })

    it('throws when proxyToDisabled and no default service is configured (no header)', () => {
      expect(() =>
        computeProxyTo(
          makeCtx({
            proxyToDisabled: true,
            bskyAppView: null,
            wsocialAppView: null,
          }),
          noHeaderReq,
          ids.EuWsocialAdminListNeuroAccounts,
        ),
      ).toThrow(/No service configured/)
    })
  })

  describe('parseProxyInfo', () => {
    it('returns parsed header target when header present and proxyToDisabled=false', async () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? `${WSOC.did}#wsocial_appview` : undefined,
      } as unknown as Request
      const result = await parseProxyInfo(makeCtx(), req, bskyEndpoint)
      expect(result).toEqual({ did: WSOC.did, url: WSOC.url })
    })

    it('ignores atproto-proxy header and returns default service when proxyToDisabled', async () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? `${WSOC.did}#wsocial_appview` : undefined,
      } as unknown as Request
      const result = await parseProxyInfo(
        makeCtx({ proxyToDisabled: true }),
        req,
        bskyEndpoint,
      )
      expect(result).toEqual({ did: BSKY.did, url: BSKY.url })
    })

    it('returns default service info when no header is present', async () => {
      const result = await parseProxyInfo(
        makeCtx(),
        noHeaderReq,
        wSocialEndpoint,
      )
      expect(result).toEqual({ did: WSOC.did, url: WSOC.url })
    })

    it('throws when proxyToDisabled and no default service is configured', async () => {
      const req = {
        header: (name: string) =>
          name === 'atproto-proxy' ? `${WSOC.did}#wsocial_appview` : undefined,
      } as unknown as Request
      await expect(
        parseProxyInfo(
          makeCtx({
            proxyToDisabled: true,
            bskyAppView: null,
            wsocialAppView: null,
          }),
          req,
          wSocialEndpoint,
        ),
      ).rejects.toThrow(/No service configured/)
    })
  })

  describe('parseProxyHeader fast-path', () => {
    it('fast-paths bsky appview header without calling DID resolver', async () => {
      const ctx = makeCtx()
      const result = await parseProxyHeader(ctx, `${BSKY.did}#bsky_appview`)
      expect(result).toEqual({ did: BSKY.did, url: BSKY.url })
      expect(getResolveMock(ctx)).not.toHaveBeenCalled()
    })

    it('fast-paths wsocial appview header without calling DID resolver', async () => {
      const ctx = makeCtx()
      const result = await parseProxyHeader(ctx, `${WSOC.did}#wsocial_appview`)
      expect(result).toEqual({ did: WSOC.did, url: WSOC.url })
      expect(getResolveMock(ctx)).not.toHaveBeenCalled()
    })

    it('resolves bsky DID when bskyAppView is unconfigured (fast-path skipped)', async () => {
      const resolvedUrl = 'https://resolved-bsky.example'
      const ctx = makeCtx({
        bskyAppView: null,
        didDocResponse: makeDidDoc(BSKY.did, '#bsky_appview', resolvedUrl),
      })
      const result = await parseProxyHeader(ctx, `${BSKY.did}#bsky_appview`)
      expect(result).toEqual({ did: BSKY.did, url: resolvedUrl })
      expect(getResolveMock(ctx)).toHaveBeenCalledWith(BSKY.did)
    })

    it('resolves wsocial DID when wsocialAppView is unconfigured (fast-path skipped)', async () => {
      const resolvedUrl = 'https://resolved-wsocial.example'
      const ctx = makeCtx({
        wsocialAppView: null,
        didDocResponse: makeDidDoc(WSOC.did, '#wsocial_appview', resolvedUrl),
      })
      const result = await parseProxyHeader(
        ctx,
        `${WSOC.did}#wsocial_appview`,
      )
      expect(result).toEqual({ did: WSOC.did, url: resolvedUrl })
      expect(getResolveMock(ctx)).toHaveBeenCalledWith(WSOC.did)
    })

    it('resolves DID via resolver when service id does not match a configured appview (bsky DID)', async () => {
      const resolvedUrl = 'https://other-service.example'
      const ctx = makeCtx({
        didDocResponse: makeDidDoc(BSKY.did, '#other_service', resolvedUrl),
      })
      const result = await parseProxyHeader(ctx, `${BSKY.did}#other_service`)
      expect(result).toEqual({ did: BSKY.did, url: resolvedUrl })
      expect(getResolveMock(ctx)).toHaveBeenCalledWith(BSKY.did)
    })

    it('resolves DID via resolver when service id does not match a configured appview (wsocial DID)', async () => {
      const resolvedUrl = 'https://wsoc-other-service.example'
      const ctx = makeCtx({
        didDocResponse: makeDidDoc(WSOC.did, '#other_service', resolvedUrl),
      })
      const result = await parseProxyHeader(ctx, `${WSOC.did}#other_service`)
      expect(result).toEqual({ did: WSOC.did, url: resolvedUrl })
      expect(getResolveMock(ctx)).toHaveBeenCalledWith(WSOC.did)
    })

    it('resolves third-party DID via resolver when DID is not a configured appview', async () => {
      const otherDid = 'did:plc:third-party'
      const resolvedUrl = 'https://third-party.example'
      const ctx = makeCtx({
        didDocResponse: makeDidDoc(otherDid, '#bsky_appview', resolvedUrl),
      })
      const result = await parseProxyHeader(ctx, `${otherDid}#bsky_appview`)
      expect(result).toEqual({ did: otherDid, url: resolvedUrl })
      expect(getResolveMock(ctx)).toHaveBeenCalledWith(otherDid)
    })

    it('throws when DID resolver returns null (no didDoc provided)', async () => {
      const ctx = makeCtx()
      await expect(
        parseProxyHeader(ctx, `did:plc:unknown#bsky_appview`),
      ).rejects.toThrow(/could not resolve proxy did/)
      expect(getResolveMock(ctx)).toHaveBeenCalledWith('did:plc:unknown')
    })
  })
})
