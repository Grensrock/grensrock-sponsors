"use client";

import ImageStore from "@/components/ui/ImageStore";
import { RETURN_EXAMPLES, type ReturnExampleType } from "@/lib/constants";
import { exampleLabel } from "@/lib/logo";
import { exampleRef } from "@/lib/supabase/storage";
import type { Language, TranslateFn } from "@/types";

/* Admin: manage the example pictures shown to sponsors */
export default function ExampleImagesManager({
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  return (
    <div>
      <p className="gr-muted">{t("ex.managerhint")}</p>
      <div className="gr-examplegrid">
        {(Object.keys(RETURN_EXAMPLES) as ReturnExampleType[]).map((k) => (
          <div key={k} className="gr-examplecell">
            <span className="gr-label">{exampleLabel(k, lang)}</span>
            <ImageStore image={exampleRef(k)} compact t={t} />
          </div>
        ))}
      </div>
      <div className="gr-actions">
        <button className="gr-btn" onClick={onClose}>
          {t("common.done")}
        </button>
      </div>
    </div>
  );
}
