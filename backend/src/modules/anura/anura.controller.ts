import { FastifyReply, FastifyRequest } from "fastify";
import { getConfig } from "../../config/config.js";
import { sendSuccess } from "../../utils/responses.js";
import {
  DIRECT_RAW_COLUMNS,
  DIRECT_REPORTS,
  DirectReportName,
  LIMITS,
  RAW_FILTER_OPERATORS,
} from "./anura.constants.js";
import { getCampaigns, getInstances, getOverview, getReport, getSources, getTrend, ScopeFilters, todayUtc } from "./anura.services.js";
import {
  cancelRawReport,
  deleteRawImport,
  getRawFacets,
  getRawReport,
  listRawReports,
  queryRawRows,
  RawFilter,
  removeRawReport,
  requestRawReport,
  RowQuery,
  startRawImport,
  watchAndImport,
} from "./anura.raw.services.js";

type ScopeQuery = ScopeFilters & { search?: string };
type RawParams = { id: string };

export const meta = async (_request: FastifyRequest, reply: FastifyReply) => {
  const config = getConfig();
  return sendSuccess(reply, {
    data: {
      configured: Boolean(config.ANURA_API_TOKEN),
      defaultInstance: config.ANURA_INSTANCE_ID || null,
      today: todayUtc(),
      limits: LIMITS,
      reports: Object.entries(DIRECT_REPORTS).map(([key, r]) => ({ key, label: r.label, drill: r.drill })),
      rawColumns: ["timestamp", ...DIRECT_RAW_COLUMNS],
      rawFilterOperators: RAW_FILTER_OPERATORS,
      liveRefreshSeconds: config.ANURA_CACHE_TTL_SECONDS,
    },
  });
};

export const instances = async (_request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await getInstances() });

export const sources = async (request: FastifyRequest, reply: FastifyReply) => {
  const q = request.query as ScopeQuery;
  return sendSuccess(reply, { data: await getSources(q, q.search) });
};

export const campaigns = async (request: FastifyRequest, reply: FastifyReply) => {
  const q = request.query as ScopeQuery;
  return sendSuccess(reply, { data: await getCampaigns(q, q.search) });
};

export const overview = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await getOverview(request.query as ScopeFilters) });

export const trend = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await getTrend(request.query as ScopeFilters) });

export const report = async (request: FastifyRequest, reply: FastifyReply) => {
  const { name } = request.params as { name: DirectReportName };
  const q = request.query as ScopeFilters & Record<string, any>;
  const drill = Object.fromEntries(DIRECT_REPORTS[name].drill.map((p) => [p, q[p] as string | undefined]));

  const data = await getReport(name, q, {
    drill,
    rates: q.rates,
    rules: q.rules,
    search: q.search,
    startswith: q.startswith,
    sort: q.sort,
    page: q.page,
    limit: q.limit,
  });
  return sendSuccess(reply, { data });
};

export const rawList = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await listRawReports(request.query as { page?: number; limit?: number; search?: string }) });

export const rawRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as {
    start: string;
    end: string;
    instance?: string;
    name?: string;
    standard?: string[];
    additional?: number[];
    filters?: RawFilter[];
    autoImport?: boolean;
  };
  const { autoImport = true, ...input } = body;
  const res = await requestRawReport(input);
  if (autoImport && res.id) watchAndImport(res.id, Number(request.authUser!.id));
  return sendSuccess(reply, { statusCode: 201, message: res.message, data: { id: res.id } });
};

export const rawGet = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await getRawReport((request.params as RawParams).id) });

export const rawCancel = async (request: FastifyRequest, reply: FastifyReply) => {
  const res = await cancelRawReport((request.params as RawParams).id);
  return sendSuccess(reply, { message: res?.message ?? "Cancelled" });
};

export const rawRemove = async (request: FastifyRequest, reply: FastifyReply) => {
  const res = await removeRawReport((request.params as RawParams).id);
  return sendSuccess(reply, { message: res?.message ?? "Removed" });
};

export const rawImport = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = await startRawImport((request.params as RawParams).id, Number(request.authUser!.id));
  return sendSuccess(reply, { statusCode: 202, message: "Import started", data });
};

export const rawDeleteImport = async (request: FastifyRequest, reply: FastifyReply) => {
  await deleteRawImport((request.params as RawParams).id);
  return sendSuccess(reply, { message: "Imported rows deleted" });
};

export const rawRows = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await queryRawRows((request.params as RawParams).id, request.body as RowQuery) });

export const rawFacets = async (request: FastifyRequest, reply: FastifyReply) =>
  sendSuccess(reply, { data: await getRawFacets((request.params as RawParams).id, request.body as RowQuery) });
