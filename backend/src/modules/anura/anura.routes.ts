import { FastifyInstance } from "fastify";
import { ALL_DRILL_PARAMS, DIRECT_RAW_COLUMNS, DIRECT_REPORT_NAMES, RAW_FILTER_OPERATORS } from "./anura.constants.js";
import {
  campaigns,
  instances,
  meta,
  overview,
  rawCancel,
  rawDeleteImport,
  rawFacets,
  rawGet,
  rawImport,
  rawList,
  rawRemove,
  rawRequest,
  rawRows,
  report,
  sources,
  trend,
} from "./anura.controller.js";

const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const text = { type: "string", maxLength: 500 };

const scopeProperties = {
  start: date,
  end: date,
  instance: { type: "string", maxLength: 100 },
  source: text,
  campaign: text,
};
const scopeQuery = {
  type: "object",
  required: ["start", "end"],
  properties: { ...scopeProperties, search: text },
};

const rawParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" } },
};

const rowFilter = {
  type: "object",
  required: ["column", "operator"],
  properties: {
    column: { type: "string", pattern: "^[a-z0-9_]{1,64}$" },
    operator: {
      type: "string",
      enum: [...RAW_FILTER_OPERATORS, "in", "not_in", "gte", "lte"],
    },
    value: { anyOf: [text, { type: "array", maxItems: 200, items: text }] },
  },
};

// All Anura data requires a signed-in user. Mounted at /api/v1/anura
export default async function anuraRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/meta", meta);
  app.get("/instances", instances);
  app.get("/sources", { schema: { querystring: scopeQuery } }, sources);
  app.get("/campaigns", { schema: { querystring: scopeQuery } }, campaigns);
  app.get("/overview", { schema: { querystring: scopeQuery } }, overview);
  app.get("/trend", { schema: { querystring: scopeQuery } }, trend);

  app.get(
    "/reports/:name",
    {
      schema: {
        params: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", enum: DIRECT_REPORT_NAMES } },
        },
        querystring: {
          type: "object",
          required: ["start", "end"],
          properties: {
            ...scopeProperties,
            ...Object.fromEntries(ALL_DRILL_PARAMS.map((p) => [p, text])),
            rates: { type: "boolean" },
            rules: { type: "boolean" },
            search: text,
            startswith: { type: "boolean" },
            sort: { type: "string", pattern: "^\\d{1,2}:(asc|desc)(,\\d{1,2}:(asc|desc)){0,2}$" },
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 1000 },
          },
        },
      },
    },
    report,
  );

  /* Raw data reports */

  app.get(
    "/raw",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 1000 },
            search: text,
          },
        },
      },
    },
    rawList,
  );

  app.post(
    "/raw",
    {
      schema: {
        body: {
          type: "object",
          required: ["start", "end"],
          additionalProperties: false,
          properties: {
            start: date,
            end: date,
            instance: { type: "string", maxLength: 100 },
            name: { type: "string", maxLength: 200 },
            autoImport: { type: "boolean" },
            standard: { type: "array", items: { type: "string", enum: [...DIRECT_RAW_COLUMNS] }, uniqueItems: true },
            additional: { type: "array", items: { type: "integer", minimum: 1, maximum: 10 }, uniqueItems: true },
            filters: {
              type: "array",
              maxItems: 20,
              items: {
                type: "object",
                required: ["column", "operator"],
                properties: {
                  column: { type: "string", maxLength: 64 },
                  operator: { type: "string", enum: RAW_FILTER_OPERATORS },
                  value: text,
                },
              },
            },
          },
        },
      },
    },
    rawRequest,
  );

  app.get("/raw/:id", { schema: { params: rawParams } }, rawGet);
  app.post("/raw/:id/cancel", { schema: { params: rawParams } }, rawCancel);
  app.delete("/raw/:id", { preHandler: app.requireRoot, schema: { params: rawParams } }, rawRemove);

  app.post("/raw/:id/import", { schema: { params: rawParams } }, rawImport);
  app.delete("/raw/:id/import", { schema: { params: rawParams } }, rawDeleteImport);

  const rowsBody = {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 500, default: 50 },
      sort: { type: "string", pattern: "^[a-z0-9_]{1,64}$" },
      dir: { type: "string", enum: ["asc", "desc"] },
      q: text,
      filters: { type: "array", maxItems: 30, items: rowFilter },
    },
  };
  app.post("/raw/:id/rows", { schema: { params: rawParams, body: rowsBody } }, rawRows);
  app.post("/raw/:id/facets", { schema: { params: rawParams, body: rowsBody } }, rawFacets);
}
