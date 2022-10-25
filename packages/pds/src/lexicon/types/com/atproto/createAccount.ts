/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface InputSchema {
  email: string;
  username: string;
  inviteCode?: string;
  password: string;
  recoveryKey?: string;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface HandlerError {
  status: number;
  message?: string;
  error?:
    | 'InvalidUsername'
    | 'InvalidPassword'
    | 'InvalidInviteCode'
    | 'UsernameNotAvailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface OutputSchema {
  jwt: string;
  username: string;
  did: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
