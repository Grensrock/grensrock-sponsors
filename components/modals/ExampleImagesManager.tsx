"use client";

import ImageStore from "@/components/ui/ImageStore";
import { RETURN_EXAMPLES, type ReturnExampleType } from "@/lib/constants";
import { exampleKey, exampleLabel } from "@/lib/logo";

/* Admin: manage the example pictures shown to sponsors */
export default function ExampleImagesManager({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <p className="gr-muted">
        Upload one picture per type of return. Sponsors see the pictures that apply to their own agreement, so they
        know what their logo on the poster, the LED boarding or a fence cover actually looks like.
      </p>
      <div className="gr-examplegrid">
        {(Object.keys(RETURN_EXAMPLES) as ReturnExampleType[]).map((k) => (
          <div key={k} className="gr-examplecell">
            <span className="gr-label">{exampleLabel(k, "en")}</span>
            <ImageStore storageKey={exampleKey(k)} compact />
          </div>
        ))}
      </div>
      <div className="gr-actions">
        <button className="gr-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
