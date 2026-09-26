import { getConfig } from "../../config/config.js";
import { AppError } from "../../utils/AppError.js";

type Params = Record<string, unknown>;
type BodyFormat = "json" | "form";

const REQUEST_TIMEOUT_MS = 120_000;

/** Anura returns every string URL encoded (instance cells are URL encoded JSON). */
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const deepDecode = (value: unknown): any => {
  if (typeof value === "string") return safeDecode(value);
  if (Array.isArray(value)) return value.map(deepDecode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepDecode(v)]));
  }
  return value;
};

/** Anura asks for string parameter values to be URL encoded. */
const deepEncode = (value: unknown): any => {
  if (typeof value === "string") return encodeURIComponent(value);
  if (Array.isArray(value)) return value.map(deepEncode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepEncode(v)]));
  }
  return value;
};

/** PHP style form encoding: arrays as key[]=v, objects as key[i][field]=v. */
const toFormBody = (params: Params) => {
  const form = new URLSearchParams();
  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        item && typeof item === "object" ? append(`${key}[${i}]`, item) : append(`${key}[]`, item),
      );
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) append(`${key}[${k}]`, v);
    } else if (typeof value === "boolean") {
      // Anura ignores "true"/"false" strings in form bodies but accepts 1/0.
      form.append(key, value ? "1" : "0");
    } else {
      form.append(key, String(value));
    }
  };
  for (const [k, v] of Object.entries(params)) append(k, v);
  return form;
};

const clean = (params: Params): Params =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

let detectedFormat: BodyFormat | null = null;

const formatsToTry = (): BodyFormat[] => {
  const configured = getConfig().ANURA_BODY_FORMAT;
  if (configured === "json" || configured === "form") return [configured];
  return detectedFormat ? [detectedFormat] : ["json", "form"];
};

export class AnuraError extends AppError {
  expose = true;
  constructor(message: string, public upstreamStatus: number) {
    // Upstream auth problems are a server misconfiguration from the dashboard user's point of view.
    super(message, upstreamStatus === 400 || upstreamStatus === 404 ? upstreamStatus : 502);
  }
}

const describeError = async (res: Response) => {
  let detail = "";
  try {
    const body = deepDecode(await res.json());
    detail = body?.error ?? body?.message ?? "";
    if (typeof detail !== "string") detail = JSON.stringify(detail);
  } catch {
    /* non JSON body */
  }
  const prefix =
    res.status === 401
      ? "Anura rejected the API token"
      : res.status === 403
        ? "The Anura API token lacks permission for this request"
        : `Anura API error ${res.status}`;
  return detail ? `${prefix}: ${detail}` : prefix;
};

const send = async (path: string, params: Params, format: BodyFormat) => {
  const url = `${getConfig().ANURA_API_URL}${path}`;
  const init: RequestInit =
    format === "json"
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(deepEncode(params)),
        }
      : {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: toFormBody(params),
        };
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err: any) {
    throw new AnuraError(`Could not reach the Anura API: ${err?.message ?? err}`, 503);
  }
};

const callAnura = async (path: string, rawParams: Params) => {
  const token = getConfig().ANURA_API_TOKEN;
  if (!token) throw new AnuraError("ANURA_API_TOKEN is not configured on the server", 500);

  const params = { token, ...clean(rawParams) };
  const formats = formatsToTry();
  let lastError: AnuraError | null = null;

  for (const [i, format] of formats.entries()) {
    const res = await send(path, params, format);
    if (res.ok) {
      detectedFormat = format;
      return deepDecode(await res.json());
    }
    lastError = new AnuraError(await describeError(res), res.status);
    // While the body format is still unknown, a 400/401 may just mean Anura didn't parse it.
    const canRetry = i < formats.length - 1 && (res.status === 400 || res.status === 401 || res.status === 415);
    if (!canRetry) break;
  }
  throw lastError!;
};

// Short lived cache + in-flight de-duplication so many dashboard viewers don't multiply upstream calls.
const cache = new Map<string, { expires: number; value: Promise<any> }>();

export const anuraRequest = async <T = any>(
  path: string,
  params: Params = {},
  { ttlMs = getConfig().ANURA_CACHE_TTL_SECONDS * 1000 }: { ttlMs?: number } = {},
): Promise<T> => {
  if (ttlMs <= 0) return callAnura(path, params);

  const key = `${path}?${JSON.stringify(Object.entries(clean(params)).sort(([a], [b]) => a.localeCompare(b)))}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const value = callAnura(path, params);
  cache.set(key, { expires: now + ttlMs, value });
  value.catch(() => cache.delete(key));

  if (cache.size > 1000) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  }
  return value;
};
