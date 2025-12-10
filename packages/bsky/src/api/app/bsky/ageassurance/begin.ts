import crypto from 'node:crypto'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { getAgeAssuranceRegionConfig } from '@atproto/api'
import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { InputSchema } from '../../../../lexicon/types/app/bsky/ageassurance/begin'
import { httpLogger as log } from '../../../../logger'
import { ActorInfo } from '../../../../proto/bsky_pb'
import { AGE_ASSURANCE_CONFIG } from '../../../age-assurance/const'
import {
  KWS_SUPPORTED_LANGUAGES,
  KWS_V2_COUNTRIES,
} from '../../../age-assurance/kws/const'
import {
  KWSExternalPayloadTooLargeError,
  KWSExternalPayloadVersion,
  serializeKWSExternalPayloadV2,
} from '../../../age-assurance/kws/external-payload'
import { createEvent } from '../../../age-assurance/stash'
import { createLocationString } from '../../../age-assurance/util'
import { getClientUa } from '../../../kws/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.ageassurance.begin({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input, req }) => {
      if (!ctx.kwsClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }

      const actorDid = auth.credentials.iss
      const actorInfo = await getAgeVerificationState(ctx, actorDid)
      const existingStatus = actorInfo?.ageAssuranceStatus?.status
      const existingAccess = actorInfo?.ageAssuranceStatus?.access

      if (existingStatus === 'blocked') {
        throw new InvalidRequestError(
          `Cannot initiate age assurance flow from current state: ${existingStatus}`,
          'InvalidInitiation',
        )
      }

      const attemptId = crypto.randomUUID()
      const { email, language, countryCode, regionCode } = validateInput(
        input.body,
      )

      let externalPayload: string
      try {
        externalPayload = serializeKWSExternalPayloadV2({
          version: KWSExternalPayloadVersion.V2,
          actorDid,
          attemptId,
          countryCode,
          regionCode,
        })
      } catch (err) {
        if (err instanceof KWSExternalPayloadTooLargeError) {
          log.error({ err, actorDid }, err.message)
          throw new InvalidRequestError(
            'Age Assurance flow failed because DID is too long',
            'DidTooLong',
          )
        }
        throw err
      }

      /*
       * Determine if age assurance config exists for this region. The calling
       * application should already have checked for this, so this is just a
       * safeguard.
       */
      const region = getAgeAssuranceRegionConfig(AGE_ASSURANCE_CONFIG, {
        countryCode,
        regionCode,
      })
      if (!region) {
        const message = 'Age Assurance is not required in this region'
        log.error({ actorDid, countryCode, regionCode }, message)
        throw new InvalidRequestError(message, 'RegionNotSupported')
      }

      const location = createLocationString(countryCode, regionCode)

      if (KWS_V2_COUNTRIES.has(region.countryCode)) {
        // `age-verified` flow
        await ctx.kwsClient.sendAgeVerifiedFlowEmail({
          location,
          email,
          externalPayload,
          language,
        })
      } else {
        // `adult-verified` flow is what we've been using prior to `age-verified`
        await ctx.kwsClient.sendAdultVerifiedFlowEmail({
          location,
          email,
          externalPayload,
          language,
        })
      }

      // If we have existing status/access for this region, retain it.
      const nextStatus =
        existingStatus && existingStatus !== 'unknown'
          ? existingStatus
          : 'pending'
      const nextAccess =
        existingAccess && existingAccess !== 'unknown'
          ? existingAccess
          : 'unknown'

      const event = await createEvent(ctx, actorDid, {
        attemptId,
        email,
        // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
        initIp: req.ip,
        initUa: getClientUa(req),
        status: nextStatus,
        access: nextAccess,
        countryCode,
        regionCode,
      })

      return {
        encoding: 'application/json',
        body: {
          lastInitiatedAt: event.createdAt,
          status: nextStatus,
          access: nextAccess,
        },
      }
    },
  })
}

function validateInput({ email, language, ...rest }: InputSchema): InputSchema {
  if (!isEmailValid(email) || isDisposableEmail(email)) {
    throw new InvalidRequestError(
      'This email address is not supported, please use a different email.',
      'InvalidEmail',
    )
  }

  return {
    email,
    language: KWS_SUPPORTED_LANGUAGES.has(language) ? language : 'en',
    ...rest,
  }
}

async function getAgeVerificationState(
  ctx: AppContext,
  actorDid: string,
): Promise<ActorInfo | undefined> {
  try {
    const res = await ctx.dataplane.getActors({
      dids: [actorDid],
      returnAgeAssuranceForDids: [actorDid],
      skipCacheForDids: [actorDid],
    })

    return res.actors[0]
  } catch (err) {
    return undefined
  }
}
