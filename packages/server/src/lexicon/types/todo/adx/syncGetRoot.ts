/**
* GENERATED CODE - DO NOT MODIFY
* Created Wed Sep 21 2022
*/
import express from 'express'

export interface QueryParams {
  did: string;
}

export type HandlerInput = undefined

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  root: string;
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
