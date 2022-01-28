import * as ucan from 'ucans'

// @TODO: For demo only, do not actually store secret keys in plaintext.
const SECRET_KEY = 'JjiTSPfawSBQrxSTEakN8GPvNxwb30MF+R3guCzu78hrzKHjNcFqkF6lTyYuLVpbMCVpPKFJTyju27mw1TA1aQ=='
export const SERVER_KEYPAIR = ucan.EdKeypair.fromSecretKey(SECRET_KEY)
export const SERVER_DID = SERVER_KEYPAIR.did()
