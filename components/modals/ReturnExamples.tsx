"use client";

import ImageStore from "@/components/ui/ImageStore";
import type { ReturnExampleType } from "@/lib/constants";
import { exampleLabel } from "@/lib/logo";
import { exampleRef } from "@/lib/supabase/storage";
import { returnTypesOf } from "@/lib/vouchers";
import type { FormulaFields, Language } from "@/types";

/* Sponsor: the pictures relevant to what they receive (or could receive) */
export default function ReturnExamples({
  deal,
  types,
  lang = "nl",
}: {
  deal?: Partial<FormulaFields> | null;
  types?: ReturnExampleType[];
  lang?: Language;
}) {
  const list = types || returnTypesOf(deal);
  if (!list || list.length === 0) return null;
  return (
    <div className="gr-examplegrid">
      {list.map((t) => (
        <ImageStore key={t} image={exampleRef(t)} readOnly label={exampleLabel(t, lang)} />
      ))}
    </div>
  );
}
