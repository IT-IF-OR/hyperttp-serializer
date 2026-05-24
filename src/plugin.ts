import type {
  HttpResponse,
  HyperPlugin,
  InternalRequest,
} from "@hyperttp/core";

export interface SerializableRequest extends InternalRequest {
  meta?: InternalRequest["meta"] & {
    trackTimings?: boolean;
    timings?: {
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
        if (!req.body) {
          return next<T>(req);
        }

        const body = req.body;

        const isObject =
          typeof body === "object" &&
          !Buffer.isBuffer(body) &&
          !(body instanceof Uint8Array) &&
          typeof (body as any).pipe !== "function";

        if (isObject) {
          const serializableReq = req as SerializableRequest;

          const isLogging = serializableReq.meta?.trackTimings;
          const start = isLogging ? process.hrtime.bigint() : 0n;

          const rawContentType =
            serializableReq.headers["content-type"] ||
            serializableReq.headers["Content-Type"];
          const contentType =
            typeof rawContentType === "string"
              ? rawContentType.toLowerCase()
              : null;

          if (!contentType || contentType.includes("application/json")) {
            serializableReq.headers["content-type"] = "application/json";
            serializableReq.body = JSON.stringify(body);
          } else if (
            contentType.includes("application/x-www-form-urlencoded")
          ) {
            serializableReq.body = new URLSearchParams(body as any).toString();
          }

          if (isLogging) {
            const end = process.hrtime.bigint();

            serializableReq.meta = serializableReq.meta || {};
            serializableReq.meta.timings = serializableReq.meta.timings || {};

            serializableReq.meta.timings.serializationMs =
              Number(end - start) / 1e6;
          }
        }

        return next<T>(req);
      };
    },
  };
}
