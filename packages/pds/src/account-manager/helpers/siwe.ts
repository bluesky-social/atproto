import { createPublicClient, createWalletClient, custom, Hex, http, SignableMessage } from 'viem'
import {
  baseSepolia
} from 'viem/chains'
import { createSiweMessage, generateSiweNonce } from 'viem/siwe'
import { AccountDb } from '../db'
import { parseErc6492Signature, isErc6492Signature } from 'viem/experimental'
import { hexToString } from 'viem'
import { InvalidRequestError } from '@atproto/xrpc-server'


export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
})


//const signature = await walletClient.signMessage({ account, message })
export const verifySIWE = async (db: AccountDb,
  did: string, siweSignature: Hex) => {

    // const found = await db.db
    // .selectFrom('account')
    // .selectAll()
    // .where('did', '=', did)
    // .executeTakeFirst()

    // if (found) {
    //   const address = found.ethAddress as `0x${string}`;

    //   console.log("IS Erc6492", isErc6492Signature(siweSignature))
    //   const { 
    //     address: recoveredAddress,
    //     data,
    //     signature,
    //   } = parseErc6492Signature(siweSignature)

    //   const verified = await publicClient.verifySiweMessage({
    //     message: data as string, signature: signature,
    //   });
    //   return verified
    //}
    //return false;

    const foundUser = await db.db
    .selectFrom('account')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()

    if (foundUser) {
      const address = foundUser.ethAddress as `0x${string}`;

      //TODO get DID from ethAddress + handle (as an ethAddress could have multiple handles)
      //I guess the DID could be gotten from the handle alone 

      const found = await db.db
      .selectFrom('siwe')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

      if (found) {
        const { siweMessage } = found

        //const { address: recoveredAddress, data, signature } = parseErc6492Signature(siweSignature)

        const verified = await publicClient.verifySiweMessage({
          message: siweMessage,
          signature: siweSignature,
        })
      
        if (verified) {
          // TODO: this because other wise a user could log in with a different account with their own sig?
          // Compare the recovered address with the stored address
          // if (recoveredAddress.toLowerCase() !== siweParsedMessage.address.toLowerCase()) {
          //   console.log("Recovered address doesn't match stored address")
          //   return false
          // }
        
          // Delete the SIWE message
          await db.db
            .deleteFrom('siwe')
            .where('did', '=', did)
            .execute()
        
          return true
        }
      }
    }
    return false;
}

export const createSIWE = async (db: AccountDb, did: string): Promise<string> => {
  const nonce = generateSiweNonce();
  const createdAt = new Date().toISOString()

  const found = await db.db
    .selectFrom('account')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()

  if (!found) {
    throw new InvalidRequestError('could not find account')
  }
  const address = found.ethAddress as `0x${string}`;

  const siweMessage = createSiweMessage({
    address: address, // get address based on did
    chainId: 84532,
    domain: 'creaton.social', // TODO: get domain from env
    nonce: nonce,
    uri: 'https://example.com/path',
    version: '1',
  })

  await db.db
    .insertInto('siwe')
    .values({ did, createdAt, siweMessage })
    .execute()

  return siweMessage
}

// export const verifySIWE = async (db: AccountDb, nonce: string, did: string): Promise<boolean> => {
//   const result = await db.db
//     .updateTable('siwe_nonce')
//     .set({ used: true })
//     .where('nonce', '=', nonce)
//     .where('did', '=', did)
//     .where('used', '=', false)
//     .executeTakeFirst()

//   return result.numUpdatedRows === 1n
// }

// export const cleanupSIWEs = async (db: AccountDb): Promise<void> => {
//   const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
//   await db.db
//     .deleteFrom('siwe_nonce')
//     .where('createdAt', '<', oneHourAgo)
//     .execute()
// }

// export const getSIWEForUser = async (db: AccountDb, identifier: string): Promise<string> => {
//   const user = await db.db
//     .selectFrom('account')
//     .where('did', '=', identifier)
//     .orWhere('email', '=', identifier.toLowerCase())
//     .selectAll()
//     .executeTakeFirst()

//   if (!user) {
//     throw new InvalidRequestError('User not found')
//   }
//return createSIWE(db, user.did)
//}