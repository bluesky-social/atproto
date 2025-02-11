import { CID } from 'multiformats'
import { MST } from '../src/mst'
import { MemoryBlockstore } from '../src/storage'
import * as k from './_keys'

describe('covering proofs', () => {
  /**
   *
   *                *                                  *
   *       _________|________                      ____|____
   *       |   |    |    |   |                    |    |    |
   *       *   b  __*__  f   *       ->         __*__  d  __*__
   *       |     |     |     |                 |  |  |   |  |  |
   *       a     c     e     g                 *  b  *   *  f  *
   *                                           |     |   |     |
   *                                           a     c   e     g
   *
   *
   *
   */
  it('two deep split ', async () => {
    const storage = new MemoryBlockstore()
    const cid = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )

    let mst = await MST.create(storage)
    mst = await mst.add(k.A0, cid)
    mst = await mst.add(k.B1, cid)
    mst = await mst.add(k.C0, cid)
    mst = await mst.add(k.E0, cid)
    mst = await mst.add(k.F1, cid)
    mst = await mst.add(k.G0, cid)

    const pointerBeforeOp = await mst.getPointer()

    mst = await mst.add(k.D2, cid)
    const proof = await mst.getCoveringProof(k.D2)

    const proofStorage = new MemoryBlockstore(proof)
    let proofMst = await MST.load(proofStorage, await mst.getPointer())
    proofMst = await proofMst.delete(k.D2)
    const pointerAfterInvert = await proofMst.getPointer()
    expect(pointerAfterInvert.equals(pointerBeforeOp)).toBe(true)
  })

  /**
   *
   *                *                               *
   *           _____|_____                      ____|____
   *           |  |   |  |                      |   |   |
   *           a  b   d  e       ->             *   c   *
   *                                            |       |
   *                                          __*__   __*__
   *                                          |   |   |   |
   *                                          a   b   d   e
   *
   *
   *
   */
  it('two deep leafless splits ', async () => {
    const storage = new MemoryBlockstore()
    const cid = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )

    let mst = await MST.create(storage)
    mst = await mst.add(k.A0, cid)
    mst = await mst.add(k.B0, cid)
    mst = await mst.add(k.D0, cid)
    mst = await mst.add(k.E0, cid)

    const pointerBeforeOp = await mst.getPointer()

    mst = await mst.add(k.C2, cid)
    const proof = await mst.getCoveringProof(k.C2)

    const proofStorage = new MemoryBlockstore(proof)
    let proofMst = await MST.load(proofStorage, await mst.getPointer())
    proofMst = await proofMst.delete(k.C2)
    const pointerAfterInvert = await proofMst.getPointer()
    expect(pointerAfterInvert.equals(pointerBeforeOp)).toBe(true)
  })
})
