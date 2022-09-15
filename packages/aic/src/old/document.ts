import { sign, validateSig } from './signature'
import { pid } from './pid'
import * as crypto from '@adxp/crypto'
import {
  Value,
  TidString,
  DidKeyString,
  Patch,
  Diff,
  Diffs,
  Document,
  Tick,
} from './types'

export { pid, sign, validateSig }

/*
  @TODO move this into tests
  Example identity tick
  {
    "tid": "3j5r-ts5-ojpm-2c",
    "did": "did:aic:zrr5lxhs4rjlowv5",
    "diffs": {
      "3j5r-ts5-o7x4-2c": {
        "adx/account_keys": [ "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV" ],
        "adx/recovery_keys": [ "did:key:zDnaeYHbbWiaCwAXvHXRyVqENDv8Sr3fwHW8P5eakkz4MqsTa" ]
      },
      "3j5r-ts5-ocuu-2c": {
        "prev": "3j5r-ts5-o7x4-2c",
        "patches": [ [ "put", [ "name" ], "aaron.blueskyweb.xyz" ] ],
        "key": "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
        "sig": "z4PWrudF88YEBqPQPhfWpiL7MFqhHhCWuKn8Ri4MyKZRcRLbSMFgP3WYKTBsfnq5TXGR9wbjJKKPSb7i1kQgisHzf"
      },
      "3j5r-ts5-ofsm-2c": {
        "prev": "3j5r-ts5-ocuu-2c",
        "patches": [ [ "del", [ "adx/account_keys" ] ] ],
        "key": "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
        "sig": "zSFwunTYyAh5ePkDgJ1Gw1nCtnqpVs1QzfXzkB9bHvoLoYKNeKsfeFHvToKT6tLiB5y9H5CBH1jgeYPtK57kodh7"
      },
      "3j5r-ts5-ojpm-2c": {
        "prev": "3j5r-ts5-ofsm-2c",
        "patches": [ [ "put", [ "hello" ], "world" ] ],
        "key": "did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV",
        "sig": "z431h9jjokS7TJ3VWT6XtbSUfTFVGUrLQi2uNMU4PbRXSNLoZS13dkkyeBrnfRrHdpiZhYGx6LCYSw5GgdEiDfEm9"
      }
    },
    "key": "did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh",
    "sig": "z3naShLa1KV5ZV5raHbuAAC2zjjyBbTp4htmCA42GKVLDQi7kSnFCteg7n5ap5uJMpsjdxLgL8E6kRR9cqyt6zqK6"
  }
  makes
  {
    'adx/recovery_keys': [ 'did:key:zDnaeYHbbWiaCwAXvHXRyVqENDv8Sr3fwHW8P5eakkz4MqsTa'],
    id: 'did:aic:zrr5lxhs4rjlowv5',
    name: 'aaron.blueskyweb.xyz'
  }
*/

export const updateTick = async (
  did: string, // the did:aic: being updated
  tid: TidString, // the consensus time of the tick's generation
  candidateDiff: Diff | Document | null, // null when only updating tid
  storedTick: Tick | null, // null when there is not db entry (did init)
  key: crypto.DidableKey, // the consortium passes in the key
): Promise<Tick> => {
  // @TODO validate that tid > all tids in the diffs
  if (storedTick === null) {
    // this is the  initial registration of a did:aic
    return registerNewDid(did, tid, candidateDiff, key)
  }

  // since storedTick is not null this is an update
  // of a registered did:aic
  if (!(await validateSig(storedTick))) {
    // this means the consortium database has been corrupted
    throw new Error('bad signature: stored tick')
  }
  if (storedTick.key !== key.did()) {
    // the consortium should not update a tick signed by a different consortium
    // this logic may get more complicated if the consortium is mid key rotation
    throw new Error('mismatch: consortium key, stored tick key')
  }
  if (storedTick.did !== did) {
    // database index is corrupted
    const error = new Error('stored tick not for did')
    Object.assign(error, {
      did: did,
      storedTickDid: storedTick.did,
    })
    throw error
  }
  // storedTick is now validated by consortium key and url
  return updateExistingValidatedDid(tid, candidateDiff, storedTick, key)
}

const registerNewDid = async (
  did: string,
  tid: TidString,
  candidateDiff: Document | null,
  key: crypto.DidableKey,
): Promise<Tick> => {
  if (candidateDiff === null) {
    // since candidateDiff is null
    // this is a request for a fresh tick of a non-existent did
    // return a signed affirmation that the did does not exist
    return (await sign(
      {
        tid: tid,
        did: did,
        error: 'not found',
        key: key.did(),
        sig: '',
      },
      key,
    )) as Tick
  }
  // since the candidateDiff is not null it is the initial state
  // calculate the did:aic from the initial state if they match make the initial tick
  const calculatedDid = `did:aic:${await pid(candidateDiff)}`
  if (did !== calculatedDid) {
    // client must calculate did correctly to accept, mostly an integrity check
    const error = new Error('calculated did does not match url')
    Object.assign(error, {
      tid: tid,
      did: did,
      calculatedDid: calculatedDid,
    })
    throw error
  }
  const diffs: Diffs = {}
  diffs[tid] = candidateDiff
  return tickFromDiffs(diffs, tid, key)
}

const updateExistingValidatedDid = async (
  tid: TidString, // the consensus time of the tick's generation
  candidateDiff: Diff | Document | null, // null when only updating tid
  storedTick: Tick, // null when there is not db entry (did init)
  key: crypto.DidableKey, // the consortium passes in the key
): Promise<Tick> => {
  if (candidateDiff === null) {
    // nothing to update return the old tick but with new tid
    return (await sign(
      {
        tid: tid,
        did: storedTick.did,
        diffs: storedTick.diffs,
        key: storedTick.key,
        sig: '',
      },
      key,
    )) as Tick
  }
  // there is a validated stored_tick and a candidateDiff
  // this is a update of the did document
  if (!(await validateSig(candidateDiff))) {
    throw new Error('diff has bad signature')
  }
  if (
    'key' in candidateDiff &&
    typeof candidateDiff.key === 'string' &&
    !validateKeyInDocForDiffs(candidateDiff.key, storedTick.diffs)
  ) {
    throw new Error('diff signed by key not in did doc')
  }
  // there is a validated stored_tick and a valid candidateDiff
  const diffs: Diffs = storedTick.diffs
  diffs[tid] = candidateDiff
  return tickFromDiffs(diffs, tid, key)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validateKeyInDocForDiffs = async (key: DidKeyString, diffs: Diffs) => {
  return true // @TODO write this
  // the 72 hour key priority window goes here :)
}

export const tickFromDiffs = async (
  diffs: Diffs,
  tid: TidString,
  key: crypto.DidableKey,
): Promise<Tick> => {
  // This function does not validate the diffs remember to do that first
  const tids = Object.keys(diffs).sort()
  if (tids.length < 1) {
    throw new Error('no diffs')
  }
  const initialState = diffs[tids[0]]
  return (await sign(
    {
      tid: tid,
      did: 'did:aic:' + (await pid(initialState)),
      diffs,
      key: key.did(),
      sig: '', // sig will be filled-in by call to sign()
    },
    key,
  )) as Tick
}

const authoriseKey = (doc: Document, diff: Diff): boolean => {
  // @TODO the 72 hour window logic needs to be here
  if (keyIn(doc, 'adx/account_keys', diff.key)) {
    return true
  }
  if (keyIn(doc, 'adx/recovery_keys', diff.key)) {
    return patchesKeysOnly(diff.patches)
  }
  return false
}

const keyIn = (
  doc: Document,
  keyList: string,
  didKey: DidKeyString,
): boolean => {
  return (
    keyList in doc &&
    Array.isArray(doc[keyList]) &&
    (doc[keyList] as string[]).includes(didKey)
  )
}

const patchesKeysOnly = (patches: Patch[]): boolean => {
  // check that the diff.patches[*][2]
  // the recovery key is only authorized to update account or recovery keys
  // only changes 'adx/account_keys' or 'adx/recovery_keys'
  return patches.every((patch: Patch) => {
    const pathSegment = patch[1][0]
    return (
      pathSegment === 'adx/account_keys' || pathSegment === 'adx/recovery_keys'
    )
  })
}

export const tickToDidDoc = async (
  tick: Tick,
  consortiumDid: string,
  key: crypto.DidableKey,
  asOf?: TidString,
): Promise<Document> => {
  const valid = await validateSig(tick)
  if (!valid) {
    throw new Error('tick has bad signature')
  }
  if (tick.key !== consortiumDid) {
    throw new Error('not signed by consortium')
  }
  const doc = await diffsToDidDoc(tick.diffs, key, asOf)
  if (doc !== null) {
    return doc
  }
  throw new Error('malformed diffs')
}

export const diffsToDidDoc = async (
  diffs: Diffs,
  key: crypto.DidableKey,
  asOf?: TidString,
): Promise<Document> => {
  // the consortium does not build doc for the client
  // but it still needs to build the docs to authorize keys as of the time the diff was signed
  const tids = Object.keys(diffs).sort() // need to visit diffs in tid order
  if (tids.length < 1) {
    throw new Error('no initial state')
  }
  let last = tids[0]
  let doc = JSON.parse(JSON.stringify(diffs[last])) as Document // the first tid is the initial state

  // add the id field
  doc['id'] = 'did:aic:' + (await pid(diffs[last])) // we calculate and add the id automatically

  for (const tid of tids.slice(1)) {
    const diff = diffs[tid] as Diff // after the first the rest are Diffs
    if (!(await validateSig(diff))) {
      console.log('INFO: ignoring: bad sig', diff)
      continue // not valid ignore it
    }
    if (!authoriseKey(doc, diff)) {
      console.log('INFO: ignoring: bad key')
      continue // not valid ignore it
    }

    const { prev, patches } = diff
    if (prev !== last) {
      console.log('INFO: ignoring: fork')
      continue
    }
    if (asOf && tid > asOf) {
      break
    }
    doc = patch(doc, patches)
    last = tid
  }
  return doc
}

const patch = (doc: Document, patches: Patch[]): Document => {
  // @TODO this needs more testing
  const updatedDoc = JSON.parse(JSON.stringify(doc)) as Document
  for (const p of patches) {
    const [op, path, value] = p
    let node = updatedDoc as Value
    for (const segment of path.slice(0, -1)) {
      if (op !== 'put' && op !== 'del') {
        throw new Error('unrecognised op')
      }
      if (typeof node !== 'object' || node === null) {
        if (op === 'put') {
          node = {}
        } else {
          return updatedDoc
        }
      }
      if (Array.isArray(node) || typeof segment === 'number') {
        throw new Error('patch does not support array traversal')
      }
      if (op === 'put' && !(segment in node)) {
        node[segment] = {}
      }
      node = node[segment]
    }
    const segment = path[path.length - 1]
    if (typeof node !== 'object' || node === null) {
      if (op === 'put') {
        node = {}
      } else {
        return updatedDoc
      }
    }
    if (Array.isArray(node) || typeof segment === 'number') {
      throw new Error('patch does not support array traversal')
    }
    if (op === 'put') {
      node[segment] = value
    }
    if (op === 'del') {
      delete node[segment]
    }
  }
  return updatedDoc
}
