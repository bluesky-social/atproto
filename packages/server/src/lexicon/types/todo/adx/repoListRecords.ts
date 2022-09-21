/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import express from 'express'

export interface QueryParams {
  nameOrDid: string;
  type: string;
  limit?: number;
  before?: string;
  after?: string;
  reverse?: boolean;
}

export type HandlerInput = undefined

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  records: {
    uri: string,
    value: {},
  }[];
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
