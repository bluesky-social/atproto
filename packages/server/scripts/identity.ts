import { EcdsaKeypair } from '@adxp/crypto'
import { PlcClient } from '@adxp/plc'

export type ServerIdentity = {
  keypair: EcdsaKeypair
  did: string
}

export const setupServerIdentity = async (
  plcUrl: string,
  name: string,
  ownUrl: string,
): Promise<ServerIdentity> => {
  const keypair = await EcdsaKeypair.create()
  const client = new PlcClient(plcUrl)
  const did = await client.createDid(keypair, keypair.did(), name, ownUrl)
  console.log('DID: ', did)
  return { keypair, did }
}
