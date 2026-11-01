"use client";

import { useEffect, useRef, useState } from "react";
import { eur } from "@/lib/money";
import { voucherTotal } from "@/lib/vouchers";
import type { Language, NumLike, VoucherRow } from "@/types";

/* The database keeps an empty field as 0. On screen it goes back to empty,
   with its placeholder, instead of a 0 to type behind. */
const shown = (rows?: VoucherRow[] | null): VoucherRow[] =>
  (rows || []).map((r) => ({ ...r, value: Number(r.value) ? r.value : "", qty: Number(r.qty) ? r.qty : "" }));

const isField = (el: EventTarget | null): el is HTMLInputElement => el instanceof HTMLInputElement;

/* ---------- Voucher breakdown editor (food & drinks) ---------- */

export default function VoucherEditor({
  amount,
  rows,
  onChange,
  lang = "en",
  defaultUnit,
  title,
  saveOnBlur = false,
}: {
  amount: NumLike;
  rows: VoucherRow[];
  /** With saveOnBlur this may return a promise; false or a rejection means it wasn't saved. */
  onChange: (rows: VoucherRow[]) => void | boolean | Promise<boolean | void>;
  lang?: Language;
  defaultUnit?: number;
  title?: string;
  /** onChange is a server round trip (the sponsor portal), not form state. */
  saveOnBlur?: boolean;
}) {
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const target = Number(amount) || 0;
  const [pieces, setPieces] = useState<NumLike>(1);
  const prevTarget = useRef(target);

  /* ---- the rows on screen are a local draft ----
     In the portal onChange saves to the database, and with the inputs bound to
     the saved rows every keystroke waited for that round trip: on mobile data
     characters vanished, and values jumbled as the answers came back out of
     step. Typing now stays here and goes out once focus leaves the fields; the
     buttons (add, remove, split) save at once, built on the draft so they never
     undo something typed but not sent yet. In a team form onChange is local
     state, and every change still goes straight through. */
  const [draft, setDraft] = useState<VoucherRow[]>(() => shown(rows));
  const [editing, setEditing] = useState(false); // one of the fields has focus
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /* The saved rows are taken over whenever nothing local stands in the way: no
     field has focus, nothing is on its way out, and the last save didn't fail —
     after a failure the draft is the only copy of what was typed. */
  const rowsKey = JSON.stringify(rows || []);
  const [syncedKey, setSyncedKey] = useState(rowsKey);
  if (rowsKey !== syncedKey && !editing && !saving && !failed) {
    setSyncedKey(rowsKey);
    setDraft(shown(rows));
  }

  const dirty = useRef(false); // typed since the last send
  const latest = useRef(0); // which send the "saving" state is waiting for
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  /* Each save goes to onChange straight away, so it takes its place in line
     before anything clicked after it: the portal runs an agreement's writes one
     at a time, and accepting the agreement must come after the split that was
     typed just before. Only the newest answer clears "saving" or sets "failed". */
  const send = (next: VoucherRow[]) => {
    dirty.current = false;
    const mine = ++latest.current;
    setSaving(true);
    setFailed(false);
    let out: Promise<boolean | void>;
    try {
      out = Promise.resolve(onChangeRef.current(next));
    } catch {
      out = Promise.resolve(false);
    }
    void out
      .then((r) => r !== false, () => false)
      .then((ok) => {
        if (mine !== latest.current) return;
        setSaving(false);
        setFailed(!ok);
      });
  };

  const commit = (next: VoucherRow[]) => {
    setDraft(next);
    if (saveOnBlur) send(next);
    else onChange(next);
  };
  const upd = (i: number, k: keyof VoucherRow, val: NumLike) => {
    const next = draft.map((r, x) => (x === i ? { ...r, [k]: val } : r));
    setDraft(next);
    if (saveOnBlur) dirty.current = true;
    else onChange(next);
  };
  const addRow = (value: NumLike = "") => commit([...draft, { value, qty: "" }]);

  /* Split the amount into n equal vouchers; the remainder goes on one odd voucher */
  const buildSplit = (n: NumLike, amt: NumLike): VoucherRow[] => {
    const count = Math.max(1, Math.floor(Number(n) || 1));
    const total = Number(amt) || 0;
    if (total <= 0) return [];
    const each = Math.floor((total / count) * 100) / 100; // round down to cents
    const rest = Math.round((total - each * count) * 100) / 100;
    if (each <= 0) return [{ value: total, qty: 1 }];
    if (rest <= 0) return [{ value: each, qty: count }];
    // leftover cents go on one odd voucher so the total still matches exactly
    const out: VoucherRow[] = count > 1 ? [{ value: each, qty: count - 1 }] : [];
    out.push({ value: Math.round((each + rest) * 100) / 100, qty: 1 });
    return out;
  };
  const splitInto = (n: NumLike) => {
    if (target > 0) commit(buildSplit(n, target));
  };

  /* Default: the whole amount on one voucher.
     When the amount changes afterwards, redo the split with the same number of
     pieces — unless the split already adds up to the new amount: then it came
     with it, like a formula's own split when another formula is picked. */
  useEffect(() => {
    if (target <= 0) return;
    const empty = (rows || []).length === 0;
    const moved = prevTarget.current !== target;
    prevTarget.current = target;
    if (!empty && (!moved || Math.abs(voucherTotal(rows) - target) < 0.005)) return;
    /* Drinks start as one voucher per ticket; a free amount starts as one voucher */
    const next =
      empty && defaultUnit ? [{ value: defaultUnit, qty: Math.round(target / defaultUnit) }] : buildSplit(pieces, target);
    commit(next);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocated = voucherTotal(draft);
  const diff = target - allocated;

  return (
    <div
      className="gr-vouchers"
      onFocus={(e) => isField(e.target) && setEditing(true)}
      onBlur={(e) => {
        if (!isField(e.target)) return; // a button giving up focus
        // moving from one of these fields to the next is still typing
        if (isField(e.relatedTarget) && e.currentTarget.contains(e.relatedTarget)) return;
        setEditing(false);
        if (dirty.current) send(draft);
      }}
    >
      <div className="gr-formulahead" style={{ marginBottom: 6 }}>
        <span className="gr-label" style={{ margin: 0 }}>
          {L("Verdeel", "Répartir", "Divide")} {eur(target)} {L("in vouchers", "en bons", "into vouchers")}
        </span>
        <div className="gr-voucherquick">
          {[5, 10, 25].map((v) => (
            <button key={v} className="gr-mini" onClick={() => addRow(v)}>
              + €{v}
            </button>
          ))}
          <button className="gr-mini" onClick={() => addRow("")}>
            + {L("Ander", "Autre", "Other")}
          </button>
        </div>
      </div>

      <div className="gr-splitrow">
        <span className="gr-muted">{L("Verdeel in", "Répartir en", "Split into")}</span>
        <input
          type="number"
          min="1"
          value={pieces}
          enterKeyHint="done"
          onChange={(e) => setPieces(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && splitInto(pieces)}
        />
        <span className="gr-muted">{L("voucher(s)", "bon(s)", "voucher(s)")}</span>
        <button className="gr-mini" onClick={() => splitInto(pieces)}>
          {L("Verdelen", "Répartir", "Split")}
        </button>
        {Number(pieces) > 1 && target > 0 && (
          <span className="gr-muted">
            ≈ {eur(Math.floor((target / Math.max(1, Math.floor(Number(pieces) || 1))) * 100) / 100)}{" "}
            {L("per voucher", "par bon", "each")}
          </span>
        )}
      </div>

      {draft.length === 0 ? (
        <p className="gr-muted" style={{ margin: "4px 0" }}>
          {L(
            "Nog geen verdeling — verdeel het bedrag hierboven.",
            "Pas encore de répartition — répartissez le montant ci-dessus.",
            "No breakdown yet — split the amount above or add voucher values.",
          )}
        </p>
      ) : (
        draft.map((r, i) => (
          <div key={i} className="gr-voucherrow">
            <span className="gr-muted">{L("Voucher van", "Bon de", "Voucher of")}</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={r.value}
              placeholder="€"
              enterKeyHint="done"
              onChange={(e) => upd(i, "value", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <span className="gr-muted">×</span>
            <input
              type="number"
              min="0"
              value={r.qty}
              placeholder={L("aantal", "nbre", "qty")}
              enterKeyHint="done"
              onChange={(e) => upd(i, "qty", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <span className="gr-voucherline">{eur((Number(r.value) || 0) * (Number(r.qty) || 0))}</span>
            <button className="gr-mini gr-danger" onClick={() => commit(draft.filter((_, x) => x !== i))}>
              ✕
            </button>
          </div>
        ))
      )}
      {draft.length > 0 && (
        <p className={"gr-voucherstatus" + (diff === 0 ? " ok" : "")}>
          {L("Verdeeld", "Réparti", "Allocated")}: <strong>{eur(allocated)}</strong> {L("van", "de", "of")}{" "}
          {eur(target)}
          {diff > 0 && (
            <>
              {" "}
              — <strong>{eur(diff)}</strong> {L("nog te verdelen", "encore à répartir", "still to divide")}
            </>
          )}
          {diff < 0 && (
            <>
              {" "}
              — <strong>{eur(-diff)}</strong> {L("te veel", "en trop", "over the purchased amount")}
            </>
          )}
          {diff === 0 && <> ✓</>}
          {/* Inline, so a save doesn't push the page down and back each time */}
          {saving && <span className="gr-muted"> · {L("opslaan…", "enregistrement…", "saving…")}</span>}
        </p>
      )}
      {/* The failure itself is said in the portal's dialog; this line stays,
          so a sponsor who closed it still sees these rows aren't saved. */}
      {failed && !saving && (
        <p className="gr-savefail" role="status">
          {L("Deze verdeling is niet opgeslagen.", "Cette répartition n'est pas enregistrée.", "This split isn't saved.")}
          <button className="gr-mini" onClick={() => send(draft)}>
            {L("Opnieuw proberen", "Réessayer", "Try again")}
          </button>
        </p>
      )}
    </div>
  );
}
