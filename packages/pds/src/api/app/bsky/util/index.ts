import DatabaseSchema from '../../../../db/database-schema'
import * as util from '../../../../db/util'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../../../../image/uri'

type ActorInfo = {
  did: string
  declaration: Declaration
  handle: string
  displayName: string | undefined
  avatar: string | undefined
}

export const getActorInfo = async (
  db: DatabaseSchema,
  imgUriBuilder: ImageUriBuilder,
  actor: string,
): Promise<ActorInfo> => {
  const actorInfo = await db
    .selectFrom('did_handle')
    .where(util.actorWhereClause(actor))
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .select([
      'did_handle.did as did',
      'did_handle.declarationCid as declarationCid',
      'did_handle.actorType as actorType',
      'did_handle.handle as handle',
      'profile.displayName as displayName',
      'profile.avatarCid as avatarCid',
    ])
    .executeTakeFirst()
  if (!actorInfo) {
    throw new Error(`Could not find entry for actor: ${actor}`)
  }
  return {
    did: actorInfo.did,
    declaration: getDeclarationSimple(actorInfo),
    handle: actorInfo.handle,
    displayName: actorInfo.displayName || undefined,
    avatar: actorInfo.avatarCid
      ? imgUriBuilder.getSignedUri({
          cid: CID.parse(actorInfo.avatarCid),
          format: 'jpeg',
          fit: 'cover',
          height: 250,
          width: 250,
          min: true,
        })
      : undefined,
  }
}

export const isEnum = <T extends { [s: string]: unknown }>(
  object: T,
  possibleValue: unknown,
): possibleValue is T[keyof T] => {
  return Object.values(object).includes(possibleValue)
}

export const getDeclaration = <T extends string>(
  prefix: T,
  info: DeclarationRow<T>,
): Declaration => {
  return {
    actorType: info[`${prefix}ActorType`],
    cid: info[`${prefix}DeclarationCid`],
  }
}

export const getDeclarationSimple = (info: {
  actorType: string
  declarationCid: string
}): Declaration => {
  return {
    actorType: info.actorType,
    cid: info.declarationCid,
  }
}

export type Declaration = { cid: string; actorType: string }

type DeclarationRow<T extends string> = {
  [key in DeclarationInputKey<T>]: string
}

type DeclarationInputKey<T extends string> =
  | `${T}ActorType`
  | `${T}DeclarationCid`
