import IonDocumentModel from '@decentralized-identity/ion-sdk/lib/models/IonDocumentModel'
import IonPublicKeyModel from '@decentralized-identity/ion-sdk/lib/models/IonPublicKeyModel'
import IonServiceModel from '@decentralized-identity/ion-sdk/lib/models/IonServiceModel'
import { KeyPair } from './keypairs.js'

interface BaseOp {
  previous?: BaseOp
  update?: KeyPair
  recovery?: KeyPair
}

export interface OpCreate extends BaseOp {
  operation: 'create'
  content: IonDocumentModel
  update: KeyPair
  recovery: KeyPair
}

export interface OpUpdateParams {
  addServices?: IonServiceModel[]
  removeServices?: string[]
  addPublicKeys?: IonPublicKeyModel[]
  removePublicKeys?: string[]
}

export interface OpUpdate extends BaseOp {
  operation: 'update'
  content: OpUpdateParams
  update: KeyPair
  previous: BaseOp
}

export interface OpRecover extends BaseOp {
  operation: 'recover'
  content: IonDocumentModel
  update: KeyPair
  recovery: KeyPair
  previous: BaseOp
}

export interface OpDeactivate extends BaseOp {
  operation: 'deactivate'
  previous: BaseOp
}

export type Op = OpCreate | OpUpdate | OpRecover | OpDeactivate
