"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Instance, Meta, ReportData, ReportKey, Scope, Totals, TrendPoint } from "./types";

const scopeQuery = (s: Scope) => ({
  start: s.start,
  end: s.end,
  instance: s.instance,
  source: s.source,
  campaign: s.campaign,
});

export const useMeta = () =>
  useQuery({ queryKey: ["anura", "meta"], queryFn: () => api<Meta>("/anura/meta"), staleTime: Infinity });

export const useInstances = () =>
  useQuery({ queryKey: ["anura", "instances"], queryFn: () => api<Instance[]>("/anura/instances"), staleTime: 5 * 60_000 });

export const useSources = (scope: Scope, enabled = true) =>
  useQuery({
    queryKey: ["anura", "sources", scope.start, scope.end, scope.instance],
    queryFn: () => api<string[]>("/anura/sources", { query: { start: scope.start, end: scope.end, instance: scope.instance } }),
    staleTime: 60_000,
    enabled,
  });

export const useCampaigns = (scope: Scope, enabled = true) =>
  useQuery({
    queryKey: ["anura", "campaigns", scope.start, scope.end, scope.instance, scope.source],
    queryFn: () =>
      api<string[]>("/anura/campaigns", {
        query: { start: scope.start, end: scope.end, instance: scope.instance, source: scope.source },
      }),
    staleTime: 60_000,
    enabled,
  });

export const useOverview = (scope: Scope, refetchMs: number | false) =>
  useQuery({
    queryKey: ["anura", "overview", scopeQuery(scope)],
    queryFn: () => api<Totals>("/anura/overview", { query: scopeQuery(scope) }),
    refetchInterval: refetchMs,
    placeholderData: keepPreviousData,
  });

export const useTrend = (scope: Scope, refetchMs: number | false) =>
  useQuery({
    queryKey: ["anura", "trend", scopeQuery(scope)],
    queryFn: () => api<TrendPoint[]>("/anura/trend", { query: scopeQuery(scope) }),
    refetchInterval: refetchMs,
    placeholderData: keepPreviousData,
  });

export interface ReportParams {
  drill: Record<string, string>;
  rates: boolean;
  rules: boolean;
  search: string;
  startswith: boolean;
  sort: string;
  page: number;
  limit: number;
}

export const useReport = (report: ReportKey, scope: Scope, params: ReportParams, refetchMs: number | false, enabled = true) => {
  const query = {
    ...scopeQuery(scope),
    ...params.drill,
    rates: params.rates || undefined,
    rules: params.rules || undefined,
    search: params.search || undefined,
    startswith: params.search && params.startswith ? true : undefined,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  };
  return useQuery({
    queryKey: ["anura", "report", report, query],
    queryFn: () => api<ReportData>(`/anura/reports/${report}`, { query }),
    refetchInterval: refetchMs,
    placeholderData: keepPreviousData,
    enabled,
  });
};
