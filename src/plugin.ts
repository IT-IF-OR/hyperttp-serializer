import type {
  HttpResponse,
  HyperPlugin,
  InternalRequest,
} from "@hyperttp/core";

export interface SerializableRequest extends InternalRequest {
  meta: InternalRequest["meta"] & {
    trackTimings?: boolean;
    timings: {
      networkMs?: number;
      serializationMs?: number;
    };
  };
}

export function withSerializer(): HyperPlugin {
  return {
    name: "hyperttp-serializer",
    phase: "FORMAT",
    enabled: () => true,

    wrapDispatch: (next) => {
      return <T>(req: InternalRequest): Promise<HttpResponse<T>> => {
        const body = req.body;
        if (!body) {
          return next<T>(req);
        }

        const isObject =
          typeof body === "object" &&
          body !== null &&
          !Buffer.isBuffer(body) &&
          !(body instanceof Uint8Array) &&
          typeof (body as any).pipe !== "function";

        if (isObject) {
          const serializableReq = req as SerializableRequest;

          const isLogging = serializableReq.meta?.trackTimings === true;
          const start = isLogging ? process.hrtime.bigint() : 0n;

          const contentType = serializableReq.headers["content-type"];

          if (!contentType || contentType.includes("application/json")) {
            serializableReq.headers["content-type"] = "application/json";
            serializableReq.body = JSON.stringify(body);
          } else if (
            contentType.includes("application/x-www-form-urlencoded")
          ) {
            serializableReq.body = new URLSearchParams(body as any).toString();
          }

          if (isLogging) {
            serializableReq.meta.timings.serializationMs =
              Number(process.hrtime.bigint() - start) / 1e6;
          }
        }

        return next<T>(req);
      };
    },
  };
}
