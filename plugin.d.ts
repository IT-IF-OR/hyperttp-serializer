import type { HyperPlugin, RequestContext, SendRequest } from "@hyperttp/types";
type RestHeaders = Record<string, string | string[]>;
type RestInput = Record<string, unknown> & {
    body?: unknown;
    headers?: RestHeaders;
};
export interface SerializerOptions<TInput = unknown, TSerialized = unknown> {
    shouldSerialize?: (request: SendRequest<TInput>, ctx?: RequestContext) => boolean;
    getBody?: (request: SendRequest<TInput>, ctx?: RequestContext) => unknown;
    setBody?: (request: SendRequest<TInput>, body: TSerialized, ctx?: RequestContext) => SendRequest<TInput>;
    serialize?: (body: unknown, request: SendRequest<TInput>, ctx?: RequestContext) => TSerialized;
}
export interface SerializableRequest extends SendRequest<RestInput, "rest"> {
}
declare module "@hyperttp/types" {
    interface HyperClientOptions {
        serializer?: SerializerOptions;
    }
}
export declare function withSerializer<TInput = unknown, TSerialized = unknown>(options?: SerializerOptions<TInput, TSerialized>): HyperPlugin<TInput>;
export {};
//# sourceMappingURL=plugin.d.ts.map