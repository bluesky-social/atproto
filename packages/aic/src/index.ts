import { TID } from '@adxp/common'
import {EcdsaKeypair, sha256, verifyDidSig} from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'

/*
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

// @TODO move this to "@adxp/common/src/common/types"
type ErrorMessage = {
  error: string
  cause?: ErrorMessage
  [key: string]: Value
}

type Value =
  | null
  | boolean
  | number
  | string
  | Value[]
  | { [key: string]: Value }
  | undefined

type TidString = string
type Signature = string
type DidKeyString = string
type Patch = ['put' | 'del', (string | number)[], Value]
type Diff = {
  prev: TidString
  patches: Patch[]
  key: DidKeyString
  sig: Signature
}
type Diffs = { [index: string]: Document | Diff } // the first diff is arbatrary JSON object initial value
type Tick = {
  tid: TidString
  did: string
  diffs: Diffs
  key: DidKeyString
  sig: Signature
}

type Document = { [key: string]: Value }

export const update_tick = async (
  did: string, // the did:aic: being updated
  tid: TID, // the consenus time of the tick's generation
  candidate_diff: Diff | Document | null, // null when only updating tid
  stored_tick: Tick | null, // null when there is not db entry (did init)
  key: EcdsaKeypair, // the consortium passes in the key
): Promise<Tick | ErrorMessage> => {
  // @TODO
  // validate that tid > all tids in the diffs

  // if candidate_diff is null just update tid and re-sign
  // if stored_tick is null the candidate_diff is inital state
  if (stored_tick === null) {
    // this is the  initial registration of a did:aic
    if (candidate_diff === null) {
      // since the stored_tick and candidate_diff are null
      // this is a request for a fresh tick of a non-exixtant did
      // return a signed affirmation that the did dose not exist
      return (await sign(
        {
          tid: tid.formatted(),
          did: did,
          error: `${did} not found`,
          diffs: {},
          key: key.did(),
          sig: '',
        },
        key,
      )) as Tick
    }
    // since the candidate_diff is not null it is the inital state
    // calulate the did:aic from the inital state if they match make the inital tick
    const calculated_did = `did:aic:${await pid(candidate_diff)}`
    if (did !== calculated_did) {
      // client must caulate did corectly to acsept, mostly an integraty check
      return { error: 'calculated did dose not match url' }
    }
    const diffs: Diffs = {}
    diffs[tid.formatted()] = candidate_diff
    return tick_from_diffs(diffs, tid, key)
  }
  // since stored_tick is not null this is an update
  // of an existing did:aic
  if (!(await validate_sig(stored_tick))) {
    return { error: 'stored tick has bad signature' }
  }
  if (stored_tick.key != key.did()) {
    return { error: 'stored tick signed by diffrent consortium' }
  }
  if (stored_tick.did != did) {
    return { error: 'stored tick did dose not match url' } // databace is corupted
  }
  // stored_tick is now validated by consortium key and url
  if (candidate_diff === null) {
    // nothing to update return the old tick but with new tid
    return (await sign(
      {
        tid: tid.formatted(),
        did: stored_tick.did,
        diffs: stored_tick.diffs,
        key: stored_tick.key,
        sig: '',
      },
      key,
    )) as Tick
  }
  // there is a validated stored_tick and a candidate_diff
  // this is a update of the did document
  if (!(await validate_sig(candidate_diff))) {
    return { error: 'diff has bad signature' }
  }
  if ('key' in candidate_diff && typeof candidate_diff.key == 'string'){
    if (!validate_key_in_doc_for_diffs(candidate_diff.key, stored_tick.diffs)) {
      return { error: 'diff signed by key not in did doc' }
    }
  }
  // there is a validated stored_tick and a valid candidate_diff
  const diffs: Diffs = stored_tick.diffs
  diffs[tid.formatted()] = candidate_diff
  return tick_from_diffs(diffs, tid, key)
}

const validate_key_in_doc_for_diffs = async (
  key: DidKeyString,
  diffs: Diffs,
) => {
  return true // @TODO write this
  // the 72 hour key prioraty window gos here :)
}

export const tick_to_diffs = async (tick: {
  sig: string
  key: string
  [index: string]: Value
}): Promise<Diffs | null> => {
  if (await validate_sig(tick)) {
    return tick.diffs as Diffs
  } else {
    return null
  }
}

export const tick_from_diffs = async (
  diffs: Diffs,
  tid: TID,
  key: EcdsaKeypair,
): Promise<Tick | ErrorMessage> => {
  // This function dose not validate the diffs remember to do that first
  const tids = Object.keys(diffs).sort()
  if (tids.length < 1) {
    return { error: 'no diffs' }
  }
  const initial_state = diffs[tids[0]]
  return (await sign(
    {
      tid: tid.formatted(),
      did: 'did:aic:' + (await pid(initial_state)),
      diffs,
      key: key.did(),
      sig: '', // sig will be filld in by call to sign
    },
    key,
  )) as Tick
}

const authorise_key = (
  doc: Document,
  diff: Diff,
): boolean => {
  if (
    'adx/account_keys' in doc && 
    Array.isArray(doc['adx/account_keys']) &&
    doc['adx/account_keys'].includes(diff.key)
  ) {
    return true
  }
  if (
    'adx/recovery_keys' in doc &&
    Array.isArray(doc['adx/recovery_keys']) &&
    doc['adx/recovery_keys'].includes(diff.key)
  ) {
    // check that the diff.patches[*][2]
    // the recovey key is only authorised to update account or recovery keys
    // only changes 'adx/account_keys' or 'adx/recovery_keys'
    // @TODO the 72 hour window logic needs to be here
    return diff.patches.every((patch: Patch) => {
      const pathSegment = patch[1][0]
      return (pathSegment === 'adx/account_keys' ||
      pathSegment === 'adx/recovery_keys')
    })
  }
  return false
}

export const tick_to_did_doc = async (tick: Tick, consortium_did: string, asOf?: TidString): Promise<Document> => {
  const valid = await validate_sig(tick)
  if (!valid){
    return { error: 'tick has bad signature' }
  }
  if (tick.key != consortium_did) {
    return { error: 'not signed by consortium' }
  }
  const doc = await diffs_to_did_doc(tick.diffs, asOf)
  if (doc !== null){
    return doc
  }
  return { error: 'malformed diffs' }
}

export const diffs_to_did_doc = async (diffs: Diffs, asOf?: TidString) => {
  // the consortium dose not build doc for the client
  // but it still needs to build the docs to authorise_keys as of the time the diff was signed
  if (typeof diffs !== 'object') {
    return null
  }
  const tids = Object.keys(diffs).sort() // need to visit diffs in tid order
  if (tids.length < 1) {
    return null // there is no initial state this is invalid
  }
  let last = tids[0]
  let doc = JSON.parse(JSON.stringify(diffs[last])) as Document // the first tid is the initial state

  // add the id feild
  doc['id'] = 'did:aic:' + (await pid(diffs[last])) // we calculate and add the id automaticly

  for (const tid of tids.slice(1)) {
    const diff = diffs[tid] as Diff // after the first the rest are Diffs
    if (!(await validate_sig(diff))) {
      console.log('INFO: ignoreing: bad sig', diff)
      continue // not valid ignore it
    }
    if (!authorise_key(doc, diff)) {
      console.log('INFO: ignoreing: bad key')
      continue // not valid ignore it
    }

    const { prev, patches } = diff
    if (prev !== last) {
      console.log('INFO: ignoreing: fork')
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

// @TODO move this to "@adxp/common/src/common/util"
const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz'
const B32_CHAR = 'abcdefghijklmnopqrstuvwxyz234567'

const s32encode = (data: Uint8Array): string => {
  // this is gross so many alocatons and funtion calls :(
  const base32 = uint8arrays.toString(data, 'base32')
  const sort_order_invariant_base32 = base32.split('').map((c) => {
    return S32_CHAR[B32_CHAR.indexOf(c)]
  })
  return sort_order_invariant_base32.join('')
}

// @TODO move this to "@adxp/common/src/common/util"
export const pid = async (
  data: Uint8Array | string | Document,
): Promise<string> => {
  if (data instanceof Uint8Array) {
    // return the pid120 a 24 char pid
    const hash = s32encode(await sha256(data))
    let twos = 0
    for (twos = 0; twos < 32; twos++) {
      if (hash[twos] !== '2') {
        break
      }
    }
    const head = S32_CHAR[31 - twos]
    const tail = hash.slice(twos, twos + 15) // 23 for pid120; 15 for pid80 // Are we ok with 80 bits?
    return head + tail
  }
  if (typeof data === 'string') {
    return pid(uint8arrays.fromString(data))
  }
  return pid(canonicaliseDocumentToUint8Array(data))
}

const patch = (doc: Document, patches: Patch[]): Document => {
  // @TODO this needs more testing
  const new_doc = JSON.parse(JSON.stringify(doc)) as Document
  for (const p of patches) {
    const [op, path, value] = p
    let node = new_doc as Value
    for (const segment of path.slice(0, -1)) {
      if (typeof node !== 'object' || node === null) {
        if (op === 'put') {
          node = {}
        } else {
          return new_doc
        }
      }
      if (Array.isArray(node) || typeof segment === 'number') {
        console.log('Warning: patch dose not support Array traversal')
        return new_doc
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
        return new_doc
      }
    }
    if (Array.isArray(node) || typeof segment === 'number') {
      console.log('Warning: patch dose not support Array traversal')
      return new_doc
    }
    if (op === 'put') {
      node[segment] = value
    }
    if (op === 'del') {
      delete node[segment]
    }
  }
  return new_doc
}

export const sign = async (doc: Document, key: EcdsaKeypair) => {
  if (doc.key !== key.did()) {
    throw Error('Info: passed in secret key and did do not match')
  }
  doc['sig'] = ''
  const data = canonicaliseDocumentToUint8Array(doc)
  const sig = await key.sign(data)
  // https://github.com/multiformats/multihash
  doc['sig'] = 'z' + uint8arrays.toString(sig, 'base58btc')
  return doc
}

export const validate_sig = async (
  doc: Document,
): Promise<boolean | ErrorMessage> => {
  if (
    typeof doc.sig !== 'string' ||
    typeof doc.key !== 'string' ||
    doc.key.length < 1
  ) {
    return false
  }

  const doc_copy = JSON.parse(JSON.stringify(doc))
  if (doc_copy.sig[0] !== 'z') {
    // check the multibase https://github.com/multiformats/multibase
    throw "signatures must be 'z'+ base58btc" // maby just retuen false?
  }
  doc_copy.sig = ''
  const data = canonicaliseDocumentToUint8Array(doc_copy)


  const sig = uint8arrays.fromString(doc.sig.slice(1), 'base58btc')
  let valid = await verifyDidSig(doc.key, data, sig)
  return valid // @TODO check that the key is in the did doc
}

export const canonicaliseDocumentToUint8Array = (
  document: Document,
): Uint8Array => {
  // @TODO canonicalise json/cbor?
  // JSON Canonicalization Scheme (JCS)
  // https://datatracker.ietf.org/doc/html/rfc8785
  return uint8arrays.fromString(JSON.stringify(document))
}
