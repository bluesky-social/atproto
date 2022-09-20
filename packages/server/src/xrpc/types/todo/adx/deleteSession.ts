/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import express from 'express'

export interface QueryParams {}

export type HandlerInput = undefined

export interface InputSchema {
  [k: string]: unknown;
}

export interface HandlerOutput {
  encoding: '';
  body: OutputSchema;
}

export interface OutputSchema {
  [k: string]: unknown;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
