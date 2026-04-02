import type { paths } from "./generated/api";

type JsonBody<T> = T extends { content: { "application/json": infer R } } ? R : never;

type StatusResponse<R> =
  R extends { 200: infer S } ? JsonBody<S> :
  R extends { 201: infer S } ? JsonBody<S> :
  R extends { 202: infer S } ? JsonBody<S> :
  never;

export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: infer R }
  ? StatusResponse<R>
  : never;

export type ApiBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { requestBody: infer B }
  ? JsonBody<B>
  : never;
