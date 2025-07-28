import crypto from 'node:crypto'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { KwsExternalPayloadError } from '../../../../kws'
import { Server } from '../../../../lexicon'
import { InputSchema } from '../../../../lexicon/types/app/bsky/unspecced/initAgeAssurance'
import { httpLogger as log } from '../../../../logger'
import { ActorInfo } from '../../../../proto/bsky_pb'
import { KwsExternalPayload } from '../../../kws/types'
import { createStashEvent, getClientUa } from '../../../kws/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.initAgeAssurance({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input, req }) => {
      if (!ctx.kwsClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support age assurance.',
        )
      }

      const actorDid = auth.credentials.iss

      const actorInfo = await getAgeVerificationState(ctx, actorDid)

      if (actorInfo?.ageAssuranceStatus) {
        if (
          actorInfo.ageAssuranceStatus.status !== 'unknown' &&
          actorInfo.ageAssuranceStatus.status !== 'pending'
        ) {
          throw new InvalidRequestError(
            `Cannot initiate age assurance flow from current state: ${actorInfo.ageAssuranceStatus.status}`,
            'InvalidInitiation',
          )
        }
      }

      const { countryCode, email, language } = validateInput(input.body)

      const attemptId = crypto.randomUUID()
      // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
      const initIp = req.ip
      const initUa = getClientUa(req)
      const externalPayload: KwsExternalPayload = { actorDid, attemptId }

      try {
        await ctx.kwsClient.sendEmail({
          countryCode: countryCode.toUpperCase(),
          email,
          externalPayload,
          language,
        })
      } catch (err) {
        if (err instanceof KwsExternalPayloadError) {
          log.error(
            { externalPayload },
            'Age Assurance flow failed because external payload got too long, which is caused by the DID being too long',
          )
          throw new InvalidRequestError(
            'Age Assurance flow failed because DID is too long',
            'DidTooLong',
          )
        }
        throw err
      }

      const event = await createStashEvent(ctx, {
        actorDid,
        attemptId,
        email,
        initIp,
        initUa,
        status: 'pending',
      })

      return {
        encoding: 'application/json',
        body: {
          status: event.status,
          lastInitiatedAt: event.createdAt,
        },
      }
    },
  })
}

// Supported languages for KWS Adult Verification.
// This list comes from KWS's AV Developer Guide PDF doc.
const kwsAvSupportedLanguages = [
  'en',
  'ar',
  'zh-Hans',
  'nl',
  'tl',
  'fr',
  'de',
  'id',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-BR',
  'pt',
  'ru',
  'es',
  'th',
  'tr',
  'vi',
]

const validateInput = (input: InputSchema): InputSchema => {
  const { countryCode, email, language } = input

  if (!isEmailValid(email) || isDisposableEmail(email)) {
    throw new InvalidRequestError(
      'This email address is not supported, please use a different email.',
      'InvalidEmail',
    )
  }

  return {
    countryCode,
    email,
    language: kwsAvSupportedLanguages.includes(language) ? language : 'en',
  }
}

const getAgeVerificationState = async (
  ctx: AppContext,
  actorDid: string,
): Promise<ActorInfo | undefined> => {
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
