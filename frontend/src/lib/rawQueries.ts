"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { RawFacets, RawReportDetail, RawReportList, RawRowsResponse, RowFilter } from "./types";

const PENDING = new Set(["In Progress", "Queued", "Pending", "Processing"]);

export const isReportPending = (status: string) => PENDING.has(status);

export const useRawReports = () =>
  useQuery({
    queryKey: ["raw", "list"],
    queryFn: () => api<RawReportList>("/anura/raw", { query: { limit: 50 } }),
    // Poll quickly while Anura is generating or we're importing, otherwise gently.
    refetchInterval: (q) => {
      const reports = q.state.data?.reports ?? [];
      const busy = reports.some((r) => isReportPending(r.status) || r.autoImport || r.import?.status === "importing");
      return busy ? 4_000 : 30_000;
    },
  });

export const useRawReport = (id: string) =>
  useQuery({
    queryKey: ["raw", "report", id],
    queryFn: () => api<RawReportDetail>(`/anura/raw/${id}`),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (isReportPending(d.status) || d.autoImport || d.import?.status === "importing") ? 3_000 : false;
    },
  });

export interface RowsQuery {
  page: number;
  limit: number;
  sort: string;
  dir: "asc" | "desc";
  q: string;
  filters: RowFilter[];
}

export const useRawRows = (id: string, query: RowsQuery, enabled: boolean) =>
  useQuery({
    queryKey: ["raw", "rows", id, query],
    queryFn: () => api<RawRowsResponse>(`/anura/raw/${id}/rows`, { method: "POST", body: query }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useRawFacets = (id: string, query: Pick<RowsQuery, "q" | "filters">, enabled: boolean) =>
  useQuery({
    queryKey: ["raw", "facets", id, query],
    queryFn: () => api<RawFacets>(`/anura/raw/${id}/facets`, { method: "POST", body: query }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useRawActions = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["raw"] });

  return {
    request: useMutation({
      mutationFn: (body: { start: string; end: string; instance?: string; name?: string; filters?: RowFilter[] }) =>
        api<{ id: string }>("/anura/raw", { method: "POST", body: { ...body, autoImport: true } }),
      onSuccess: invalidate,
    }),
    importReport: useMutation({
      mutationFn: (id: string) => api(`/anura/raw/${id}/import`, { method: "POST" }),
      onSuccess: invalidate,
    }),
    deleteImport: useMutation({
      mutationFn: (id: string) => api(`/anura/raw/${id}/import`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (id: string) => api(`/anura/raw/${id}/cancel`, { method: "POST" }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/anura/raw/${id}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
};
