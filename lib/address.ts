import { normStr } from "@/lib/normalize";
import type { StoredSponsor } from "@/types";

type AddressLike = {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  address?: string;
};

export const formatAddress = (s?: AddressLike | null) => {
  const line1 = [s?.street, s?.houseNumber].filter(Boolean).join(" ").trim();
  const line2 = [s?.postalCode, s?.city].filter(Boolean).join(" ").trim();
  const joined = [line1, line2].filter(Boolean).join(", ");
  return joined || s?.address || "";
};

/* Old sponsors kept one free-text address — best-effort split into the new fields */
export const withAddress = (s: StoredSponsor): StoredSponsor => {
  if (s.street !== undefined || s.postalCode !== undefined) return s;
  const raw = normStr(s.address);
  if (!raw) return { ...s, street: "", houseNumber: "", postalCode: "", city: "" };
  const [first, ...restParts] = raw.split(",");
  const rest = restParts.join(",").trim();
  const m = normStr(first).match(/^(.*?)[\s,]*([0-9]+[A-Za-z]?(?:\s?bus\s?\w+)?)$/);
  const street = m ? m[1].trim() : normStr(first);
  const houseNumber = m ? m[2].trim() : "";
  const pm = rest.match(/^\s*([0-9]{4,6})\s+(.*)$/);
  return {
    ...s,
    street,
    houseNumber,
    postalCode: pm ? pm[1] : "",
    city: pm ? pm[2].trim() : rest,
  };
};
