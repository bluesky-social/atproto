/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export type InputSchema = undefined
export type HandlerInput = undefined

export interface HandlerError {
  status: number;
  message?: string;
}

export type HandlerOutput = HandlerError | void
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
