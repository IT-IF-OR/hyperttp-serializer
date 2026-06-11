import type { HyperPlugin, InternalRequest } from "@hyperttp/types";

/**
 * @ru Расширенный интерфейс внутреннего запроса с метаданными времени сериализации.
 * @en Extended internal request interface with serialization timing metadata.
 */
export interface SerializableRequest extends InternalRequest {
  meta?: InternalRequest["meta"] & {
    timings?: {
      serializationMs?: number;
    };
  };
}

/**
 * @ru Создает плагин, который автоматически сериализует тела запросов (JSON или Form URL-encoded)
 * на основе Content-Type и измеряет время этой операции.
 * @en Creates a plugin that automatically serializes request bodies (JSON or Form URL-encoded)
 * based on Content-Type and measures the time of this operation.
 * @returns The configured HyperPlugin instance.
 */
export function withSerializer(): HyperPlugin {
  return {
    name: "hyperttp-serializer",

    /**
     * @ru Этот плагин всегда включен по умолчанию.
     * @en This plugin is always enabled by default.
     */
    enabled: () => true,

    /**
     * @ru Перехватывает исходящие запросы для сериализации объектных тел.
     * @en Intercepts outgoing requests to serialize object bodies.
     * @param req - The internal request object.
     */
    onRequest(req: InternalRequest): void {
      const { body } = req;
      if (!body) return;

      const isObject =
        typeof body === "object" &&
        body !== null &&
        !(body instanceof Uint8Array) &&
        !(body instanceof ArrayBuffer) &&
        !(
          typeof URLSearchParams !== "undefined" &&
          body instanceof URLSearchParams
        ) &&
        !(typeof FormData !== "undefined" && body instanceof FormData) &&
        !(typeof Blob !== "undefined" && body instanceof Blob) &&
        !("pipe" in body && typeof (body as any).pipe === "function");

      if (isObject) {
        const serializableReq = req as SerializableRequest;

        if (!serializableReq.meta) {
          serializableReq.meta = {} as NonNullable<InternalRequest["meta"]>;
        }
        if (!serializableReq.meta.timings) {
          serializableReq.meta.timings = {};
        }

        const start = performance.now();

        const headers =
          (serializableReq.headers as Record<string, string | string[]>) || {};

        /**
         * @ru Вспомогательная функция для получения значения заголовка без учета регистра.
         * @en Helper to retrieve a header value case-insensitively.
         */
        const getHeader = (name: string): string | undefined => {
          const lowerName = name.toLowerCase();
          for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === lowerName) {
              const val = headers[key];
              return Array.isArray(val) ? val[0] : val;
            }
          }
          return undefined;
        };

        const contentType = getHeader("content-type");

        if (!contentType || contentType.includes("application/json")) {
          if (typeof (headers as any).set === "function") {
            (headers as any).set("content-type", "application/json");
          } else {
            headers["content-type"] = "application/json";
          }
          serializableReq.body = JSON.stringify(body);
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          serializableReq.body = new URLSearchParams(
            body as Record<string, string>,
          ).toString();
        }

        serializableReq.meta.timings.serializationMs =
          performance.now() - start;
      }
    },
  };
}
