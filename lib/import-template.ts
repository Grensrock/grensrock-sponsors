import * as XLSX from "xlsx";
import {
  AGREEMENT_FIELDS,
  CONTACT_FIELDS,
  IMPORT_FIELDS,
  type AgreementField,
  type ContactField,
  type ImportField,
} from "@/lib/import-helpers";
import type { TranslateFn } from "@/types";

/* ============================================================
   Import templates
   ============================================================
   An .xlsx to fill in for each of the three imports. The first sheet
   holds only the column headers, because the importers read the first
   sheet and nothing else; the second explains every column. The headers
   are the column-mapping labels themselves, so autoMap recognises each
   one in either team language without anyone touching the mapping.
   ============================================================ */

/** Whether a column has to be filled in; "depends" leaves the help text to say on what. */
export type Need = "yes" | "no" | "depends";

export interface TemplateColumn {
  /** TEAM_TEXT key of the column-mapping label, which is also the header. */
  labelKey: string;
  need: Need;
  /** TEAM_TEXT key of the explanation on the second sheet. */
  helpKey: string;
}

const columns = <K extends string>(
  fields: Array<[K, string]>,
  needs: Record<K, Need>,
  scope: string,
): TemplateColumn[] => fields.map(([field, labelKey]) => ({ labelKey, need: needs[field], helpKey: `tph.${scope}.${field}` }));

export const SPONSOR_TEMPLATE = columns<ImportField>(
  IMPORT_FIELDS,
  {
    companyName: "yes",
    street: "no",
    houseNumber: "no",
    postalCode: "no",
    city: "no",
    vatNumber: "no",
    entityType: "no",
    contactFirstName: "no",
    contactLastName: "no",
    contactPhone: "no",
    contactEmail: "no",
    contactLanguage: "no",
    responsible: "no",
  },
  "sp",
);

export const CONTACT_TEMPLATE = columns<ContactField>(
  CONTACT_FIELDS,
  {
    company: "yes",
    firstName: "depends",
    lastName: "depends",
    email: "depends",
    phone: "no",
    language: "no",
    info: "no",
    invoice: "no",
  },
  "ct",
);

export const AGREEMENT_TEMPLATE = columns<AgreementField>(
  AGREEMENT_FIELDS,
  {
    sponsor: "depends",
    vatNumber: "depends",
    edition: "depends",
    formula: "depends",
    amount: "depends",
    notes: "no",
  },
  "ag",
);

/** The header as it appears in the template: the mapping label without its "*". */
export const templateHeader = (t: TranslateFn, labelKey: string) => t(labelKey).replace(/\s*\*$/, "");

/** Builds the workbook; `extra` rows go under the column explanations. */
export function buildTemplate(cols: TemplateColumn[], t: TranslateFn, extra: string[][] = []): XLSX.WorkBook {
  const headers = cols.map((c) => templateHeader(t, c.labelKey));
  const data = XLSX.utils.aoa_to_sheet([headers]);
  data["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));

  const guide = XLSX.utils.aoa_to_sheet([
    [t("tpl.note")],
    [],
    [t("tpl.col"), t("tpl.need"), t("tpl.help")],
    ...cols.map((c, i) => [headers[i], t("tpl.need." + c.need), t(c.helpKey)]),
    ...(extra.length ? [[], ...extra] : []),
  ]);
  guide["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 100 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, data, t("tpl.datasheet"));
  XLSX.utils.book_append_sheet(wb, guide, t("tpl.guidesheet"));
  return wb;
}

export function downloadTemplate(fileName: string, cols: TemplateColumn[], t: TranslateFn, extra: string[][] = []) {
  XLSX.writeFile(buildTemplate(cols, t, extra), fileName);
}
