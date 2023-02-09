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
