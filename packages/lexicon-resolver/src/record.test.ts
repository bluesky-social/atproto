import { beforeEach, describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import type { NsidString } from '@atproto/lex-schema'
import { type StubAccount, StubPds } from './_stub-pds.test.js'
import { type AtprotoRecordResolver, buildRecordResolver } from './record.js'

const COLLECTION: NsidString = 'com.example.post'

describe(buildRecordResolver, () => {
  let pds: StubPds
  let alice: StubAccount
  let resolveRecord: AtprotoRecordResolver

  beforeEach(async () => {
    pds = new StubPds()
    alice = await pds.createAccount('alice')
    resolveRecord = buildRecordResolver({
      rpc: { fetch: pds.fetch },
      idResolver: pds.idResolver,
    })
  })

  const post = (rkey: string, text: string) =>
    pds.createRecord(alice, COLLECTION, rkey, { $type: COLLECTION, text })

  it('resolves record by AT-URI object.', async () => {
    const created = await post('post1', 'post1')
    const result = await resolveRecord(created.uri)
    expect(result.commit.did).toEqual(alice.did)
    expect(result.cid.toString()).toEqual(created.cid.toString())
    expect(result.uri.toString()).toEqual(created.uri.toString())
    expect(result.record.text).toEqual('post1')
  })

  it('resolves record by AT-URI string.', async () => {
    const created = await post('post2', 'post2')
    const result = await resolveRecord(created.uri.toString())
    expect(result.commit.did).toEqual(alice.did)
    expect(result.cid.toString()).toEqual(created.cid.toString())
    expect(result.uri.toString()).toEqual(created.uri.toString())
    expect(result.record.text).toEqual('post2')
  })

  it("does not resolve record that doesn't exist.", async () => {
    await post('post1', 'post1')
    await expect(
      resolveRecord(`at://${alice.did}/${COLLECTION}/2222222222222`),
    ).rejects.toThrow('Record not found')
  })

  it('does not resolve record with bad commit signature.', async () => {
    const created = await post('post3', 'post3')
    const bob = await pds.createAccount('bob')
    // switch alice's key away from the one her repo is signed with
    pds.updateIdentity(alice.did, (data) => ({
      ...data,
      verificationMethods: { atproto: bob.keypair.did() },
    }))
    await expect(resolveRecord(created.uri)).rejects.toThrow(
      'Invalid signature on commit',
    )
  })

  it('does not resolve record with corrupted CAR block.', async () => {
    const created = await post('post4', 'post4')
    await alice.storage.putBlock(created.cid, encode({}))
    await expect(resolveRecord(created.uri)).rejects.toThrow(
      'Malformed record proof',
    )
  })

  it('does not resolve record with missing signing key.', async () => {
    const created = await post('post5', 'post5')
    pds.updateIdentity(alice.did, (data) => ({
      ...data,
      verificationMethods: {
        not_atproto: data.verificationMethods.atproto,
      },
    }))
    await expect(resolveRecord(created.uri)).rejects.toThrow(
      'Incomplete DID identity data: missing signing key',
    )
  })

  it('does not resolve record with missing pds.', async () => {
    const created = await post('post6', 'post6')
    pds.updateIdentity(alice.did, (data) => ({
      ...data,
      services: { not_atproto_pds: data.services.atproto_pds },
    }))
    await expect(resolveRecord(created.uri)).rejects.toThrow(
      'Incomplete DID identity data: missing pds',
    )
  })

  it('resolves record despite missing at:// handle.', async () => {
    const created = await post('post7', 'post7')
    pds.updateIdentity(alice.did, (data) => ({
      ...data,
      alsoKnownAs: data.alsoKnownAs.map((aka) =>
        aka.replace('at://', 'notat://'),
      ),
    }))
    const result = await resolveRecord(created.uri.toString())
    expect(result.commit.did).toEqual(alice.did)
    expect(result.cid.toString()).toEqual(created.cid.toString())
    expect(result.uri.toString()).toEqual(created.uri.toString())
    expect(result.record.text).toEqual('post7')
  })
})
