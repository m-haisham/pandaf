import { Elysia } from "elysia";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createRequest,
  createResponse as createMockResponse,
} from "node-mocks-http";
import type { MockRequest, MockResponse } from "node-mocks-http";

export type ConnectMiddleware = (
  req: MockRequest<IncomingMessage>,
  res: MockResponse<ServerResponse>,
  next: (err?: unknown) => void,
) => unknown;

export interface ConnectApp {
  handle(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void;
}

async function transformRequest(
  request: Request,
): Promise<MockRequest<IncomingMessage>> {
  const parsedURL = new URL(request.url, "http://localhost");

  const query: Record<string, unknown> = {};
  for (const [key, value] of parsedURL.searchParams.entries()) {
    query[key] = value;
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  if (!headers.host) {
    headers.host = parsedURL.host;
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    body = undefined;
  }

  return createRequest({
    method: request.method as any,
    url: parsedURL.pathname + parsedURL.search,
    path: parsedURL.pathname,
    originalUrl: parsedURL.pathname + parsedURL.search,
    baseUrl: parsedURL.origin,
    headers,
    query,
    body: body as any,
  }) as MockRequest<IncomingMessage>;
}

function transformResponse(
  serverResponse: MockResponse<ServerResponse>,
): Response {
  return new Response(
    serverResponse._getData() || serverResponse._getBuffer(),
    {
      status: serverResponse.statusCode,
      statusText: serverResponse.statusMessage,
      headers: serverResponse.getHeaders() as Record<string, string>,
    },
  );
}

function makeResponse(
  request: IncomingMessage,
  resolve: (value: Response) => void,
): MockResponse<ServerResponse> {
  const response = createMockResponse({
    req: request,
  });

  if (!(response as any)._implicitHeader) {
    (response as any)._implicitHeader = () => {};
  }

  const end = response.end;
  response.end = function (...args: Parameters<typeof response.end>) {
    const call = end.call(response, ...args);
    const webResponse = transformResponse(response);
    resolve(webResponse);
    return call;
  } as typeof response.end;

  return response;
}

export function mountConnect(app: ConnectApp) {
  return new Elysia({ name: "connect" }).onRequest(
    async function processConnect({ request, set }) {
      let message: MockRequest<IncomingMessage>;
      try {
        message = await transformRequest(request);
      } catch {
        set.status = 400;
        return new Response("Bad Request", { status: 400 });
      }

      return await new Promise<Response | undefined>((resolve) => {
        const response = makeResponse(message, resolve);

        try {
          app.handle(message, response, () => {
            const webResponse = transformResponse(response);
            webResponse.headers.forEach((value, key) => {
              set.headers[key] = value;
            });
            set.status = webResponse.status;
            resolve(undefined);
          });
        } catch (err) {
          console.error("[pandaf] Connect middleware error:", err);
          set.status = 500;
          resolve(new Response("Internal Server Error", { status: 500 }));
        }
      });
    },
  ) as any;
}
