export const isEnum = <T extends { [s: string]: unknown }>(
  object: T,
  possibleValue: unknown,
): possibleValue is T[keyof T] => {
  return Object.values(object).includes(possibleValue)
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
