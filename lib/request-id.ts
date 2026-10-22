import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

export function requestId(req: Request): string {
  const provided = req.headers.get("x-request-id")?.trim();
  return provided && REQUEST_ID_PATTERN.test(provided) ? provided : randomUUID();
}

export function withRequestId(
  response: Response,
  id: string
): Response {
  response.headers.set("x-request-id", id);
  return response;
}

export function logRequestError(scope: string, id: string, error: unknown) {
  console.error(`[${scope}] requestId=${id}`, error);
}
