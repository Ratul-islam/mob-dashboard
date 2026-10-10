import { gunzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { getConfig } from "../../config/config.js";
import { AppError } from "../../utils/AppError.js";
import { everflowConversions, EverflowConversionRow, everflowTransactions, everflowUploads } from "./everflow.model.js";

/* ----------------------------------------------------------------------------------------------
 * Everflow conversions, uploaded as a conversions export (Reporting > Conversions > Export CSV)
 * and matched to raw rows by transaction ID (one click), the value Anura receives in an
 * additional data field.
 * -------------------------------------------------------------------------------------------- */

// Uncompressed size cap, so a small gzip body can't expand without limit.
const MAX_CSV_BYTES = 200 * 1024 * 1024;

const headerToKey = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Export columns we read, by every header name Everflow (or a spreadsheet re-save) may use. */
const FIELDS = {
  transactionId: ["transaction_id"],
  conversionId: ["conversion_id"],
  status: ["conversion_status", "status"],
  convertedAt: ["date", "conversion_date"],
  clickAt: ["click_date"],
  revenue: ["revenue"],
  payout: ["payout"],
  offer: ["network_offer_name", "offer_name", "offer"],
  affiliate: ["network_affiliate_name", "affiliate_name", "affiliate"],
  type: ["type"],
  event: ["event", "event_name"],
} satisfies Record<string, string[]>;
type Field = keyof typeof FIELDS;

/** Milliseconds `timeZone` is ahead of UTC at the instant `time`. */
const zoneOffset = (time: number, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(time))
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - time;
};

/** A wall clock time in `timeZone` as a UTC instant (DST aware). */
const zonedToUtc = (y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string) => {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
};

/** Export times carry no zone; they are in the Everflow account's reporting time zone. */
const parseDate = (value: string | undefined, timeZone: string): Date | null => {
  if (!value) return null;
  // YYYY-MM-DD HH:mm[:ss] as exported, or M/D/YYYY H:mm[:ss] as re-saved by spreadsheet apps
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const [y, mo, d, h = "0", mi = "0", s = "0"] = iso
    ? iso.slice(1)
    : us
      ? [us[3], us[1], us[2], ...us.slice(4)]
      : [];
  if (y) return zonedToUtc(+y, +mo, +d, +h, +mi, +s, timeZone);
  // Anything else must carry its own zone
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
};

const cut = (value: string | undefined, length: number) => value?.trim().slice(0, length) || null;
const money = (value: string | undefined) => Number(String(value ?? "").replace(/[$,\s]/g, "")) || 0;

const readCsv = (body: Buffer): string[][] => {
  let buffer = body;
  // gzip magic bytes: the dashboard compresses uploads to stay under proxy body limits
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      buffer = gunzipSync(buffer, { maxOutputLength: MAX_CSV_BYTES });
    } catch {
      throw new AppError("The uploaded file could not be decompressed", 400);
    }
  }
  try {
    return parse(buffer, { bom: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
  } catch (err: any) {
    throw new AppError(`The file is not a valid CSV: ${err?.message ?? err}`, 400);
  }
};

/** Turns export rows into conversion rows. Rows without a transaction or conversion ID are skipped. */
const toConversions = (records: string[][]) => {
  const timeZone = getConfig().EVERFLOW_TIMEZONE;
  try {
    zoneOffset(Date.now(), timeZone);
  } catch {
    throw new AppError(`EVERFLOW_TIMEZONE "${timeZone}" is not a valid time zone`, 500);
  }
  const [header, ...data] = records;
  const keys = (header ?? []).map(headerToKey);
  const index = Object.fromEntries(
    (Object.keys(FIELDS) as Field[]).map((f) => [f, FIELDS[f].map((name) => keys.indexOf(name)).find((i) => i >= 0) ?? -1]),
  ) as Record<Field, number>;
  if (index.transactionId < 0 || index.conversionId < 0) {
    throw new AppError(
      "This doesn't look like an Everflow conversions export: it needs transaction_id and conversion_id columns",
      400,
    );
  }

  const byId = new Map<string, EverflowConversionRow>();
  const now = new Date();
  for (const record of data) {
    const get = (f: Field) => (index[f] >= 0 ? record[index[f]]?.trim() : undefined);
    const conversionId = get("conversionId");
    const transactionId = get("transactionId");
    if (!conversionId || !transactionId) continue;

    // "CV" marks a base conversion; anything else in type, or an event column, is a post-conversion event.
    const type = get("type");
    const event = get("event") || (type && !/^(cv|conversion)$/i.test(type) ? type : undefined);
    byId.set(conversionId, {
      conversionId: conversionId.slice(0, 64),
      transactionId: transactionId.slice(0, 64),
      status: cut(get("status")?.toLowerCase(), 32),
      isEvent: Boolean(event),
      event: cut(event, 255),
      revenue: money(get("revenue")),
      payout: money(get("payout")),
      offer: cut(get("offer"), 512),
      affiliate: cut(get("affiliate"), 255),
      clickAt: parseDate(get("clickAt"), timeZone),
      convertedAt: parseDate(get("convertedAt"), timeZone),
      receivedAt: now,
    });
  }
  return { rows: data.length, conversions: [...byId.values()] };
};

const excluded = (column: string) => sql.raw(`VALUES(\`${column}\`)`);

/** Recomputes the per-click rollup from the stored conversions. */
const rebuildTransactions = async (transactionIds: string[]) => {
  const c = everflowConversions;
  const valid = sql`(${c.status} IS NULL OR ${c.status} NOT IN ('rejected', 'invalid'))`;
  for (let i = 0; i < transactionIds.length; i += 500) {
    const ids = transactionIds.slice(i, i + 500);
    await db.execute(sql`
      INSERT INTO ${everflowTransactions}
        (transaction_id, status, conversions, events, event_names, revenue, payout, offer, affiliate, click_at, first_conversion_at, last_conversion_at, synced_at)
      SELECT ${c.transactionId},
        CASE
          WHEN SUM(${c.status} = 'approved') > 0 THEN 'approved'
          WHEN SUM(${c.status} = 'pending') > 0 THEN 'pending'
          WHEN SUM(${c.status} = 'rejected') > 0 THEN 'rejected'
          ELSE MAX(${c.status})
        END,
        SUM(${valid} AND NOT ${c.isEvent}), SUM(${valid} AND ${c.isEvent}),
        LEFT(GROUP_CONCAT(DISTINCT IF(${valid}, NULLIF(${c.event}, ''), NULL) ORDER BY ${c.event} SEPARATOR ', '), 512),
        ROUND(SUM(IF(${valid}, ${c.revenue}, 0)), 4), ROUND(SUM(IF(${valid}, ${c.payout}, 0)), 4), MAX(${c.offer}),
        MAX(${c.affiliate}), MIN(${c.clickAt}),
        COALESCE(MIN(IF(${valid}, ${c.convertedAt}, NULL)), MIN(${c.convertedAt})),
        COALESCE(MAX(IF(${valid}, ${c.convertedAt}, NULL)), MAX(${c.convertedAt})),
        UTC_TIMESTAMP()
      FROM ${c}
      WHERE ${inArray(c.transactionId, ids)}
      GROUP BY ${c.transactionId}
      ON DUPLICATE KEY UPDATE
        status = ${excluded("status")}, conversions = ${excluded("conversions")}, events = ${excluded("events")},
        event_names = ${excluded("event_names")}, revenue = ${excluded("revenue")}, payout = ${excluded("payout")},
        offer = ${excluded("offer")}, affiliate = ${excluded("affiliate")}, click_at = ${excluded("click_at")}, first_conversion_at = ${excluded("first_conversion_at")},
        last_conversion_at = ${excluded("last_conversion_at")}, synced_at = ${excluded("synced_at")}
    `);
  }
};

/**
 * Stores an uploaded conversions export (plain or gzipped CSV). Conversions already uploaded are
 * updated, so re-uploading a later export picks up status changes such as pending -> approved.
 */
export const importConversionsCsv = async (body: Buffer, fileName: string | undefined, userId: number) => {
  const { rows, conversions } = toConversions(readCsv(body));
  if (!conversions.length) {
    throw new AppError("No conversions with a transaction ID were found in this file", 400);
  }

  for (let i = 0; i < conversions.length; i += 500) {
    await db
      .insert(everflowConversions)
      .values(conversions.slice(i, i + 500))
      .onDuplicateKeyUpdate({
        set: {
          transactionId: excluded("transaction_id"),
          status: sql`COALESCE(${excluded("status")}, ${everflowConversions.status})`,
          isEvent: excluded("is_event"),
          event: excluded("event"),
          revenue: excluded("revenue"),
          payout: excluded("payout"),
          offer: sql`COALESCE(${excluded("offer")}, ${everflowConversions.offer})`,
          affiliate: sql`COALESCE(${excluded("affiliate")}, ${everflowConversions.affiliate})`,
          clickAt: excluded("click_at"),
          convertedAt: excluded("converted_at"),
          receivedAt: excluded("received_at"),
        },
      });
  }
  const transactionIds = [...new Set(conversions.map((c) => c.transactionId))];
  await rebuildTransactions(transactionIds);

  let first: Date | null = null;
  let last: Date | null = null;
  for (const { convertedAt: at } of conversions) {
    if (at && (!first || at < first)) first = at;
    if (at && (!last || at > last)) last = at;
  }
  const upload = {
    fileName: cut(fileName, 255),
    rows,
    conversions: conversions.length,
    firstConversionAt: first,
    lastConversionAt: last,
    uploadedBy: userId || null,
    uploadedAt: new Date(),
  };
  await db.insert(everflowUploads).values(upload);

  const statuses: Record<string, number> = {};
  for (const c of conversions) statuses[c.status ?? "unknown"] = (statuses[c.status ?? "unknown"] ?? 0) + 1;
  return { ...upload, skipped: rows - conversions.length, clicks: transactionIds.length, statuses };
};

export const latestUpload = async () => {
  const [row] = await db.select().from(everflowUploads).orderBy(desc(everflowUploads.id)).limit(1);
  return row
    ? {
        fileName: row.fileName,
        conversions: row.conversions,
        firstConversionAt: row.firstConversionAt,
        lastConversionAt: row.lastConversionAt,
        uploadedAt: row.uploadedAt,
      }
    : null;
};
