/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import express from 'express'

export interface QueryParams {
  nameOrDid: string;
  type: string;
  tid: string;
}

export type HandlerInput = undefined

export interface HandlerOutput {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface OutputSchema {
  uri: string;
  value: {};
}

export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput
