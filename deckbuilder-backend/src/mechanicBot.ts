/**
 * Token-gated mechanic writer. Grok Bot calls these routes instead of the UI.
 *
 * Auth: `Authorization: Bearer <mechanic-bot token>`. The raw token is never
 * stored. Supabase checks it against bot_credentials (see 20261120).
 *
 * Cards are read from Scryfall one page at a time. Marks and set progress
 * are written to Supabase. This process does not keep a card database.
 */
import type { Express, Request, Response } from "express";
import { scryfallGet } from "./scryfallClient.js";

const SET_CODE = /^[a-z0-9]{3,6}$/;
const ORACLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Face = {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
};

type ScryfallCard = {
  oracle_id?: string;
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  set?: string;
  collector_number?: string;
  card_faces?: Face[];
};

type ExistingMark = {
  oracle_id: string;
  mechanic_id: string;
  relation: string;
  status: string;
  source: string;
};

function supabaseConfig(): { base: string; key: string } | null {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  return { base: base.replace(/\/$/, ""), key };
}

function bearer(req: Request): string | null {
  const header = req.header("authorization") || "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function rpc(
  name: string,
  args: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  const cfg = supabaseConfig();
  if (!cfg) {
    return { ok: false, status: 503, message: "Supabase is not configured on the API" };
  }
  let res: globalThis.Response;
  try {
    res = await fetch(`${cfg.base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, status: 502, message: "Supabase unreachable" };
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    const unauthorized = res.status === 401 || /unauthorized/i.test(message);
    return { ok: false, status: unauthorized ? 401 : 502, message };
  }
  return { ok: true, data };
}

function requireToken(req: Request, res: Response): string | null {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: "Bearer token required" });
    return null;
  }
  return token;
}

function sendRpcError(res: Response, result: { status: number; message: string }) {
  res.status(result.status).json({ error: result.message });
}

function joinFace(faces: Face[] | undefined, key: keyof Face): string {
  return (faces ?? [])
    .map((face) => face[key])
    .filter((value): value is string => Boolean(value))
    .join(key === "oracle_text" ? "\n---\n" : " // ");
}

export function trimBotCard(card: ScryfallCard) {
  const faces = card.card_faces;
  return {
    oracle_id: (card.oracle_id || "").toLowerCase(),
    name: card.name || "",
    mana_cost: card.mana_cost || joinFace(faces, "mana_cost"),
    type_line: card.type_line || joinFace(faces, "type_line"),
    oracle_text: card.oracle_text || joinFace(faces, "oracle_text"),
    keywords: card.keywords ?? [],
    power: card.power ?? faces?.find((face) => face.power)?.power ?? null,
    toughness: card.toughness ?? faces?.find((face) => face.toughness)?.toughness ?? null,
    loyalty: card.loyalty ?? null,
    set: card.set ?? "",
    collector_number: card.collector_number ?? "",
  };
}

function marksByOracle(rows: ExistingMark[]): Map<string, ExistingMark[]> {
  const grouped = new Map<string, ExistingMark[]>();
  for (const row of rows) {
    const id = row.oracle_id.toLowerCase();
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
  }
  return grouped;
}

export function mountMechanicBot(app: Express) {
  app.get("/api/bot/catalog", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const result = await rpc("bot_mechanic_catalog", { token });
    if (!result.ok) return sendRpcError(res, result);
    res.json(result.data);
  });

  app.get("/api/bot/sets", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const result = await rpc("bot_list_sets", { token });
    if (!result.ok) return sendRpcError(res, result);
    res.json({ sets: result.data });
  });

  app.post("/api/bot/sets", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const sets = Array.isArray(req.body?.sets) ? req.body.sets.map((code: unknown) => String(code)) : null;
    if (!sets) return res.status(400).json({ error: "sets must be an array of set codes" });
    const result = await rpc("bot_queue_sets", { token, set_codes: sets });
    if (!result.ok) return sendRpcError(res, result);
    res.json(result.data);
  });

  app.post("/api/bot/sets/:code", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const setCode = param(req.params.code).toLowerCase();
    if (!SET_CODE.test(setCode)) return res.status(400).json({ error: "bad set code" });
    const body = req.body ?? {};
    const status = String(body.status ?? "running");
    const cursor = body.cursor == null ? "" : String(body.cursor);
    const cardsSeen = Number(body.cards_seen ?? 0);
    const marksApplied = Number(body.marks_applied ?? 0);
    const note = body.note == null ? "" : String(body.note);
    if (!Number.isInteger(cardsSeen) || !Number.isInteger(marksApplied)) {
      return res.status(400).json({ error: "cards_seen and marks_applied must be integers" });
    }
    const result = await rpc("bot_touch_set", {
      token,
      set_code: setCode,
      job_status: status,
      job_cursor: cursor,
      cards_seen: cardsSeen,
      marks_applied: marksApplied,
      note,
    });
    if (!result.ok) return sendRpcError(res, result);
    res.json(result.data);
  });

  app.get("/api/bot/sets/:code/cards", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const setCode = param(req.params.code).toLowerCase();
    if (!SET_CODE.test(setCode)) return res.status(400).json({ error: "bad set code" });
    const page = Number(req.query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 500) {
      return res.status(400).json({ error: "page must be an integer from 1 to 500" });
    }
    const gate = await rpc("bot_ping", { token });
    if (!gate.ok) return sendRpcError(res, gate);
    const query = `set:${setCode} -is:token`;
    const path = `/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=set&page=${page}`;
    let upstream: { status: number; data: unknown };
    try {
      upstream = await scryfallGet(path);
    } catch {
      return res.status(502).json({ error: "Scryfall request failed" });
    }
    const payload = upstream.data as {
      total_cards?: number;
      has_more?: boolean;
      data?: ScryfallCard[];
      details?: string;
      code?: string;
    };
    if (upstream.status === 404) {
      return res.json({
        set: setCode,
        page,
        total_cards: 0,
        has_more: false,
        cards: [],
      });
    }
    if (upstream.status !== 200 || !Array.isArray(payload?.data)) {
      return res.status(upstream.status === 422 ? 422 : 502).json({
        error: payload?.details || "Scryfall search failed",
      });
    }
    const cards = payload.data.map(trimBotCard).filter((card) => ORACLE.test(card.oracle_id));
    const ids = cards.map((card) => card.oracle_id);
    const grouped = new Map<string, ExistingMark[]>();
    if (ids.length) {
      const existing = await rpc("bot_marks", { token, oracle_ids: ids });
      if (!existing.ok) return sendRpcError(res, existing);
      for (const [id, rows] of marksByOracle((existing.data ?? []) as ExistingMark[])) {
        grouped.set(id, rows);
      }
    }
    res.json({
      set: setCode,
      page,
      total_cards: payload.total_cards ?? cards.length,
      has_more: Boolean(payload.has_more),
      next_page: payload.has_more ? page + 1 : null,
      cards: cards.map((card) => ({
        ...card,
        marks: (grouped.get(card.oracle_id) ?? []).map((mark) => ({
          mechanic_id: mark.mechanic_id,
          relation: mark.relation,
          status: mark.status,
          source: mark.source,
        })),
      })),
    });
  });

  app.post("/api/bot/marks", async (req, res) => {
    const token = requireToken(req, res);
    if (!token) return;
    const marks = Array.isArray(req.body?.marks) ? req.body.marks : [];
    const remove = Array.isArray(req.body?.remove) ? req.body.remove : [];
    if (!marks.length && !remove.length) {
      return res.status(400).json({ error: "pass marks and/or remove" });
    }
    if (marks.length > 200 || remove.length > 200) {
      return res.status(400).json({ error: "at most 200 marks or removals per call" });
    }
    const applied = marks.length
      ? await rpc("bot_apply_marks", { token, marks })
      : { ok: true as const, data: { applied: 0, skipped: 0, errors: [] } };
    if (!applied.ok) return sendRpcError(res, applied);
    const retracted = remove.length
      ? await rpc("bot_retract_marks", { token, marks: remove })
      : { ok: true as const, data: { removed: 0, skipped: 0, errors: [] } };
    if (!retracted.ok) return sendRpcError(res, retracted);
    res.json({ apply: applied.data, retract: retracted.data });
  });
}
