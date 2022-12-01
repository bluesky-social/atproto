/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface InputSchema {
  token: string;
  password: string;
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'ExpiredToken' | 'InvalidToken';
}

export type HandlerOutput = HandlerError | void
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
