"use client";

import { useEffect, useRef, useState } from "react";
import { eur } from "@/lib/money";
import { voucherTotal } from "@/lib/vouchers";
import type { Language, NumLike, VoucherRow } from "@/types";

/* ---------- Voucher breakdown editor (food & drinks) ---------- */

export default function VoucherEditor({
  amount,
  rows,
  onChange,
  lang = "en",
  defaultUnit,
  title,
}: {
  amount: NumLike;
  rows: VoucherRow[];
  onChange: (rows: VoucherRow[]) => void;
  lang?: Language;
  defaultUnit?: number;
  title?: string;
}) {
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const target = Number(amount) || 0;
  const allocated = voucherTotal(rows);
  const diff = target - allocated;
  const [pieces, setPieces] = useState<NumLike>(1);
  const prevTarget = useRef(target);
  const upd = (i: number, k: keyof VoucherRow, val: NumLike) =>
    onChange(rows.map((r, x) => (x === i ? { ...r, [k]: val } : r)));
  const addRow = (value: NumLike = "") => onChange([...(rows || []), { value, qty: "" }]);

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
    if (target > 0) onChange(buildSplit(n, target));
  };

  /* Default: the whole amount on one voucher.
     When the amount changes afterwards, redo the split with the same number of pieces. */
  useEffect(() => {
    if (target <= 0) return;
    if ((rows || []).length === 0) {
      /* Drinks start as one voucher per ticket; a free amount starts as one voucher */
      onChange(
        defaultUnit && target > 0
          ? [{ value: defaultUnit, qty: Math.round(target / defaultUnit) }]
          : buildSplit(pieces, target),
      );
      return;
    }
    if (prevTarget.current !== target) {
      prevTarget.current = target;
      onChange(buildSplit(pieces, target));
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="gr-vouchers">
      <div className="gr-formulahead" style={{ marginBottom: 6 }}>
        <span className="gr-label" style={{ margin: 0 }}>
          {L("Verdeel", "Répartir", "Divide")} {eur(target)} {L("in bonnen", "en bons", "into vouchers")}
        </span>
        <div className="gr-voucherquick">
          {[5, 10, 25].map((v) => (
            <button key={v} className="gr-mini" onClick={() => addRow(v)}>
              + €{v}
            </button>
          ))}
          <button className="gr-mini" onClick={() => addRow("")}>
            + Other
          </button>
        </div>
      </div>

      <div className="gr-splitrow">
        <span className="gr-muted">{L("Verdeel in", "Répartir en", "Split into")}</span>
        <input
          type="number"
          min="1"
          value={pieces}
          onChange={(e) => setPieces(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && splitInto(pieces)}
        />
        <span className="gr-muted">{L("bon(nen)", "bon(s)", "voucher(s)")}</span>
        <button className="gr-mini" onClick={() => splitInto(pieces)}>
          {L("Verdelen", "Répartir", "Split")}
        </button>
        {Number(pieces) > 1 && target > 0 && (
          <span className="gr-muted">
            ≈ {eur(Math.floor((target / Math.max(1, Math.floor(Number(pieces) || 1))) * 100) / 100)}{" "}
            {L("per bon", "par bon", "each")}
          </span>
        )}
      </div>

      {(rows || []).length === 0 ? (
        <p className="gr-muted" style={{ margin: "4px 0" }}>
          {L(
            "Nog geen verdeling — verdeel het bedrag hierboven.",
            "Pas encore de répartition — répartissez le montant ci-dessus.",
            "No breakdown yet — split the amount above or add voucher values.",
          )}
        </p>
      ) : (
        (rows || []).map((r, i) => (
          <div key={i} className="gr-voucherrow">
            <span className="gr-muted">{L("Bon van", "Bon de", "Voucher of")}</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={r.value}
              placeholder="€"
              onChange={(e) => upd(i, "value", e.target.value)}
            />
            <span className="gr-muted">×</span>
            <input
              type="number"
              min="0"
              value={r.qty}
              placeholder="qty"
              onChange={(e) => upd(i, "qty", e.target.value)}
            />
            <span className="gr-voucherline">{eur((Number(r.value) || 0) * (Number(r.qty) || 0))}</span>
            <button className="gr-mini gr-danger" onClick={() => onChange(rows.filter((_, x) => x !== i))}>
              ✕
            </button>
          </div>
        ))
      )}
      {(rows || []).length > 0 && (
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
        </p>
      )}
    </div>
  );
}
