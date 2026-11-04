export {
  SpaceCredentialAgent,
  type SpaceCredentialAgentOptions,
} from './agent.js'
export {
  CLIENT_ATTESTATION_TYP,
  CLOCK_SKEW_SEC,
  DELEGATION_TOKEN_TYP,
  SPACE_CREDENTIAL_MAX_AGE_SEC,
  SPACE_CREDENTIAL_TYP,
  type SpaceToken,
  type SpaceTokenHeader,
  type SpaceTokenPayload,
  type SpaceTokenType,
  type VerifySpaceTokenOpts,
  createClientAttestation,
  createDelegationToken,
  createSpaceCredential,
  parseSpaceToken,
  spaceHostAud,
  verifySpaceToken,
} from './credential.js'
export {
  SpaceError,
  SpaceKemError,
  SpaceMacError,
  SpaceMetaArchiveError,
  SpaceRepoVerificationError,
  SpaceResponseError,
  SpaceSignatureError,
  SpaceTokenError,
  StarParseError,
} from './error.js'
export {
  type SpaceSignature,
  type SpaceSignatureOptions,
  createSpaceSig,
  createSpaceSigHeaders,
  isP256DidKey,
  verifyCredentialSig,
} from './http-signature.js'
export { type Encapsulation, decapsulate, encapsulate } from './kem.js'
export { LtHash } from './lthash.js'
export {
  COMMIT_MAC_TYPE,
  MAC_HEADER,
  MAC_TYPE_BY_METHOD,
  type MacType,
  RECORD_MAC_TYPE,
  RECORD_MAC_VERSION,
  WANT_MAC_HEADER,
  computeCommitMac,
  computeRecordMac,
  formatMacHeader,
  formatWantMacHeader,
  parseMacHeader,
  parseWantMacHeader,
  verifyCommitMac,
  verifyRecordMac,
} from './mac.js'
export {
  RepoCommit,
  type VerifyCommitParams,
  verifyCommit,
} from './repo-commit.js'
export {
  type PolicyStateEntry,
  type SpaceMetaArchive,
  type SpaceMetaWriter,
  readSpaceMetaStar,
  writeSpaceMetaStar,
} from './space-meta-archive.js'
export {
  STAR_MAGIC,
  type StarMeta,
  type StarPair,
  type StarReader,
  readStar,
  writeStar,
} from './star.js'
export {
  type SerializedRecord,
  type VerifiedRecord,
  type VerifiedSpaceRepo,
  type VerifyRecordParams,
  type VerifySpaceRepoParams,
  readRepoStar,
  serializeRecord,
  verifyRecord,
  verifyRepoStar,
  verifyRepoStarFull,
  writeRepoStar,
} from './sync/index.js'
export {
  COMMIT_VERSION,
  type CommitCtx,
  MAX_RECORD_SIZE,
  type RecordPathParts,
  type RecordPathString,
  type RepoOp,
  type RepoStarMeta,
  SPACE_META_VERSION,
  type SpaceCommit,
  type SpaceMetaStarMeta,
  type SpaceRecord,
} from './types.js'
export { formatRecordPath, parseRecordPath } from './util.js'
