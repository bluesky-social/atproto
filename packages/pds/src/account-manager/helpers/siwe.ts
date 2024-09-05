import { createPublicClient, createWalletClient, custom, Hex, http } from 'viem'
import {
  mainnet
} from 'viem/chains'
import { createSiweMessage, generateSiweNonce } from 'viem/siwe'
import { AccountDb } from '../db'

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
})


//const signature = await walletClient.signMessage({ account, message })
export const verifySIWE = async (db: AccountDb,
  did: string, siweSignature: Hex) => {

    const found = await db.db
    .selectFrom('account')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()


    if (found) {
      const address = found.ethAddress as `0x${string}`;
      const message = createSiweMessage({
        address: address,
        chainId: 11155111,
        domain: 'creaton.social', //TODO: get domain from env
        nonce: "test123", //TODO generated random nonce or time based?
        uri: 'https://example.com/path',
        version: '1',
      })
      return await publicClient.verifySiweMessage({
        message, signature: siweSignature,
      });
    }
    return false;
  //TODO: compare if address in SIWE (maybe both SIWE addr field and the recovered public key?) is same as found address
}