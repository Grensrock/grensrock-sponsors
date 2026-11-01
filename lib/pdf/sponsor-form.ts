/* ============================================================
   The sponsor form: a PDF the team hands a sponsor to fill in
   ============================================================
   What we know of the sponsor, already filled in, beside the formulas of
   one edition to choose from — for a sponsor met in person, or one who
   would rather return a form than use the portal. It is a real PDF form:
   the fields can be typed into on a computer, and printed they are boxes
   to write in by hand.

   Built in the browser with pdf-lib, which the modal only loads when it is
   used (components/modals/SponsorFormModal.tsx). Form fields need a font
   every viewer has, so this is the standard Helvetica — and that knows
   Western European letters and little else, which is why everything
   written into the PDF goes through winAnsi() first.

   The sponsor reads this, so nothing internal reaches it: not the
   agreement's notes, nor its settlement, nor who approved what.
   ============================================================ */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFRadioGroup } from "pdf-lib";
import { benefitChanges, isCustom } from "@/lib/benefits";
import { NO_FORMULA_COLOR, formulaColor } from "@/lib/color";
import { contactName, sponsorContacts, voucherContact } from "@/lib/contacts";
import { eur } from "@/lib/money";
import { userName } from "@/lib/users";
import { ticketLines, visibilityLines } from "@/lib/vouchers";
import type { Deal, Edition, Language, NumLike, Sponsor, User } from "@/types";

export interface SponsorFormInput {
  sponsor: Sponsor;
  edition: Edition;
  /** The sponsor's agreement for this edition, if there is one: it comes ticked. */
  deal?: Deal | null;
  /** Who the form goes back to: the sponsor's responsible. */
  responsible?: User | null;
  lang: Language;
  /** assets/wordmark.png; the header goes without it when it couldn't be read. */
  wordmark?: ArrayBuffer | Uint8Array | null;
}

/* ---------- Text Helvetica can write ----------
   WinAnsi: Latin-1 plus the euro sign, curly quotes, dashes and a few more.
   Unicode spaces become plain ones (Intl writes a narrow one in French
   amounts), accents it lacks are dropped (ź becomes z, Ł an L), and
   anything else becomes "?" rather than throwing halfway through a PDF. */
const WIN_ANSI_HIGH = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
/* Letters NFD doesn't take apart into a base letter and an accent. */
const BARE: Record<string, string> = { ł: "l", Ł: "L", đ: "d", Đ: "D", ı: "i" };
const encodable = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_HIGH.includes(ch);
};

export const winAnsi = (s: unknown) =>
  Array.from(
    String(s ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[ -   　]/g, " ")
      .replace(/[​-‍⁠﻿]/g, "")
      .replace(/[‐‑−]/g, "-"),
  )
    .map((ch) => {
      if (encodable(ch)) return ch;
      const bare = BARE[ch] ?? ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return bare && Array.from(bare).every(encodable) ? bare : "?";
    })
    .join("");

/* ---------- Look ----------
   The app's palette (styles/grensrock.css), as in the mails. */
const hex = (h: string) =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#1c1a1c");
const MUT = hex("#6e6a73");
const SUB = hex("#b9b4c0");
const LINE = hex("#e4e1da");
const CARD = hex("#f7f5f1");
const PINK = hex("#c9518d");
const WHITE = rgb(1, 1, 1);
const RAINBOW = ["#4a90c4", "#4fa05f", "#c9c463", "#de8140", "#c9518d"].map(hex);

const A4: [number, number] = [595.28, 841.89];
const M = 42; // side margins
const W = A4[0] - 2 * M;
const BOTTOM = 50; // the footer sits below this
const FIELD_H = 18;
const BOX = 11; // checkboxes and radio buttons

/* Where the lettering sits in assets/wordmark.png (512 × 512, transparent
   around it): measured, so the header can put the letters flush left. */
const MARK = { size: 512, x0: 54, y0: 170, x1: 459, y1: 342 };

const LOCALES: Record<Language, string> = { nl: "nl-BE", fr: "fr-BE", en: "en-GB" };

/* "3–5 juli 2026", "3-5 juillet 2026": the edition's days as its sponsors read them. */
function dateRange(start: string, end: string, lang: Language) {
  const day = (s: string) => new Date(`${s}T12:00:00Z`);
  if (!start || isNaN(+day(start))) return [start, end].filter(Boolean).join(" – ");
  const fmt = new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  if (!end || end === start || isNaN(+day(end))) return fmt.format(day(start));
  return fmt.formatRange(day(start), day(end));
}

/* Words to lines no wider than `width`; a word longer than a line is cut. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  const lines: string[] = [];
  let line = "";
  for (const word of winAnsi(text).split(/ +/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (!fits(line) && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && !fits(line.slice(0, cut))) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** sponsorformulier-grensrock-2026-brouwerij-vanhonsebrouck.pdf */
export const sponsorFormFileName = (sponsor: Sponsor, edition: Edition, lang: Language) =>
  [
    { nl: "sponsorformulier", fr: "formulaire-sponsoring", en: "sponsorship-form" }[lang],
    edition.name,
    sponsor.companyName,
  ]
    .map((s) =>
      winAnsi(s)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("-") + ".pdf";

interface Choice {
  key: string;
  name: string;
  color: string;
  cost: NumLike;
  tickets: string[];
  visibility: string[];
}

export async function sponsorFormPdf({
  sponsor,
  edition,
  deal,
  responsible,
  lang,
  wordmark,
}: SponsorFormInput): Promise<Uint8Array> {
  const T = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  const title = T("Sponsorformulier", "Formulaire de sponsoring", "Sponsorship form");

  const doc = await PDFDocument.create();
  doc.setTitle(`${title} ${edition.name} – ${sponsor.companyName}`);
  doc.setAuthor("Grensrock");
  doc.setCreator("Grensrock sponsorplatform");
  doc.setLanguage(LOCALES[lang]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = wordmark ? await doc.embedPng(wordmark).catch(() => null) : null;
  const form = doc.getForm();

  /* ----- pages and the cursor -----
     `y` is the top of whatever is drawn next; it only goes down. */
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  /* The no-break space eur() puts after the sign keeps wrap() from parting
     the two; drawn, it is a plain space, which every viewer gives a width. */
  const write = (s: string, x: number, baseline: number, size = 9, font = regular, color = INK) =>
    page.drawText(winAnsi(s).replace(/ /g, " "), { x, y: baseline, size, font, color });
  const writeRight = (s: string, right: number, baseline: number, size = 9, font = regular, color = INK) =>
    write(s, right - font.widthOfTextAtSize(winAnsi(s), size), baseline, size, font, color);

  const newPage = () => {
    page = doc.addPage(A4);
    pages.push(page);
    const band = A4[0] / RAINBOW.length;
    RAINBOW.forEach((color, i) =>
      page.drawRectangle({ x: i * band, y: A4[1] - 6, width: band + 0.5, height: 6, color }),
    );
    y = A4[1] - 34;
    /* Past the first page, a running head says whose form a loose page is. */
    if (pages.length > 1) {
      write(`${title} ${edition.name}`, M, y - 8, 8, bold, MUT);
      writeRight(sponsor.companyName, M + W, y - 8, 8, regular, MUT);
      y -= 28;
    }
  };
  /* Start a new page unless `h` more still fits on this one. */
  const need = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };

  const paragraph = (s: string, size = 9.5, font = regular, color = INK, width = W, x = M) => {
    const lead = size * 1.4;
    for (const line of wrap(s, font, size, width)) {
      need(lead);
      write(line, x, y - size, size, font, color);
      y -= lead;
    }
  };

  /* ----- fields ----- */
  const fieldStyle = { textColor: INK, backgroundColor: WHITE, borderColor: SUB, borderWidth: 0.75 };

  /** A text field with its label above; `top` is the top of the label. */
  const textField = (
    name: string,
    label: string,
    x: number,
    top: number,
    width: number,
    value: unknown = "",
    { height = FIELD_H, multiline = false, size = 9.5 } = {},
  ) => {
    if (label) write(label, x, top - 7.5, 7.5, regular, MUT);
    const boxTop = label ? top - 11 : top;
    const field = form.createTextField(name);
    if (multiline) field.enableMultiline();
    const text = winAnsi(value).trim();
    if (text) field.setText(text);
    field.addToPage(page, { ...fieldStyle, x, y: boxTop - height, width, height, font: regular });
    field.setFontSize(size);
  };
  const LABELLED = 11 + FIELD_H; // a labelled field, top of label to bottom of box

  const checkBox = (name: string, x: number, bottom: number, checked: boolean) => {
    const box = form.createCheckBox(name);
    box.addToPage(page, { ...fieldStyle, borderColor: INK, x, y: bottom, width: BOX, height: BOX });
    if (checked) box.check();
  };
  const radio = (group: PDFRadioGroup, option: string, x: number, bottom: number) =>
    group.addOptionToPage(option, page, { ...fieldStyle, borderColor: INK, x, y: bottom, width: BOX, height: BOX });

  /* ----- sections ----- */
  let section = 0;
  /** A numbered heading; `keep` is how much of what follows must fit beside it. */
  const heading = (text: string, hint = "", keep = 0) => {
    const hintLines = hint ? wrap(hint, regular, 8.5, W) : [];
    need(34 + hintLines.length * 12 + keep);
    section++;
    y -= 8;
    write(String(section), M, y - 12, 12, bold, PINK);
    write(text, M + 15, y - 12, 12, bold, INK);
    y -= 18;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.75, color: LINE });
    y -= 8;
    for (const line of hintLines) {
      write(line, M, y - 8.5, 8.5, regular, MUT);
      y -= 12;
    }
    y -= 4;
  };

  /* ================= Page 1: who it is for ================= */
  newPage();
  const headTop = y;
  if (logo) {
    const letters = 84; // width of the lettering
    const s = (letters * MARK.size) / (MARK.x1 - MARK.x0);
    page.drawImage(logo, {
      x: M - (s * MARK.x0) / MARK.size,
      y: headTop - s + (s * MARK.y0) / MARK.size,
      width: s,
      height: s,
    });
  }
  writeRight(title, M + W, headTop - 18, 18, bold, INK);
  writeRight(edition.name, M + W, headTop - 34, 11, bold, PINK);
  const when = [dateRange(edition.startDate, edition.endDate, lang), edition.location].filter(Boolean).join(" · ");
  if (when) writeRight(when, M + W, headTop - 47, 9, regular, MUT);
  y = headTop - 66;

  paragraph(
    T(
      "Hieronder vindt u de gegevens die we van u hebben. Kijk ze na, vul aan wat ontbreekt en duid de formule aan die u wenst. U kunt dit formulier op uw computer invullen, of het afdrukken en met de hand invullen.",
      "Vous trouverez ci-dessous les données dont nous disposons. Vérifiez-les, complétez ce qui manque et indiquez la formule souhaitée. Vous pouvez remplir ce formulaire sur votre ordinateur, ou l'imprimer et le compléter à la main.",
      "Below are the details we have for you. Please check them, fill in what is missing and mark the formula you would like. You can fill in this form on your computer, or print it and fill it in by hand.",
    ),
  );
  const backTo = responsible
    ? [userName(responsible), responsible.email ? `(${responsible.email})` : ""].filter(Boolean).join(" ")
    : "";
  y -= 3;
  paragraph(
    backTo
      ? T(
          `Bezorg het ingevuld en ondertekend terug aan ${backTo}.`,
          `Merci de le renvoyer complété et signé à ${backTo}.`,
          `Please return it, completed and signed, to ${backTo}.`,
        )
      : T(
          "Bezorg het ingevuld en ondertekend terug aan uw contactpersoon bij Grensrock.",
          "Merci de le renvoyer complété et signé à votre contact chez Grensrock.",
          "Please return it, completed and signed, to your contact at Grensrock.",
        ),
    9.5,
    bold,
  );

  /* ================= 1. The sponsor ================= */
  heading(T("Uw gegevens", "Vos coordonnées", "Your details"), "", 4 * (LABELLED + 9));
  const GAP = 12;
  const half = (W - GAP) / 2;

  textField("company", T("Bedrijf / naam", "Société / nom", "Company / name"), M, y, W, sponsor.companyName);
  y -= LABELLED + 9;

  /* What kind of sponsor, on the left; the VAT number beside it. */
  write(T("Rechtsvorm", "Forme juridique", "Legal form"), M, y - 7.5, 7.5, regular, MUT);
  const entity = form.createRadioGroup("entity");
  let ex = M;
  (
    [
      ["legal", T("Onderneming of vereniging", "Entreprise ou association", "Company or organisation")],
      ["person", T("Natuurlijke persoon", "Personne physique", "Private individual")],
    ] as const
  ).forEach(([value, text]) => {
    radio(entity, value, ex, y - 11 - (FIELD_H + BOX) / 2);
    write(text, ex + BOX + 5, y - 11 - FIELD_H / 2 - 3, 9);
    ex += BOX + 5 + regular.widthOfTextAtSize(winAnsi(text), 9) + 16;
  });
  entity.select(sponsor.entityType === "person" ? "person" : "legal");

  const vatX = M + half + GAP;
  const noVatText = T("Geen btw-nummer", "Pas de numéro de TVA", "No VAT number");
  const noVatW = BOX + 5 + regular.widthOfTextAtSize(winAnsi(noVatText), 8.5);
  const vatW = half - noVatW - 10;
  textField("vat", T("BTW-nummer", "Numéro de TVA", "VAT number"), vatX, y, vatW, sponsor.vatNumber);
  checkBox("no_vat", vatX + vatW + 10, y - 11 - (FIELD_H + BOX) / 2, !!sponsor.noVatNumber && !sponsor.vatNumber);
  write(noVatText, vatX + vatW + 10 + BOX + 5, y - 11 - FIELD_H / 2 - 3, 8.5);
  y -= LABELLED + 9;

  const numW = 80;
  textField("street", T("Straat", "Rue", "Street"), M, y, W - numW - GAP, sponsor.street);
  textField("number", T("Nummer", "Numéro", "Number"), M + W - numW, y, numW, sponsor.houseNumber);
  y -= LABELLED + 9;
  textField("postal_code", T("Postcode", "Code postal", "Postal code"), M, y, numW, sponsor.postalCode);
  textField("city", T("Gemeente", "Commune", "City"), M + numW + GAP, y, W - numW - GAP, sponsor.city);
  y -= LABELLED + 9;
  need(LABELLED + 9);
  textField(
    "invoice_reference",
    T(
      "Referentie of bestelbonnummer voor op de factuur, als u er een nodig hebt",
      "Référence ou numéro de bon de commande pour la facture, si vous en avez besoin",
      "Reference or purchase order number for the invoice, if you need one",
    ),
    M,
    y,
    W,
    deal?.invoiceReference,
  );
  y -= LABELLED + 4;

  /* ================= 2. Contact persons ================= */
  const contacts = sponsorContacts(sponsor);
  /* Room to add people too: at least two empty rows, and four in all. */
  const rows = contacts.length + Math.max(2, 4 - contacts.length);
  const ROW = FIELD_H + 6;
  const cols = { name: 120, email: 140, phone: 88, lang: 30 };
  const checkW = (W - cols.name - cols.email - cols.phone - cols.lang - 4 * 6) / 3;
  const colX = {
    name: M,
    email: M + cols.name + 6,
    phone: M + cols.name + cols.email + 12,
    lang: M + cols.name + cols.email + cols.phone + 18,
    checks: M + cols.name + cols.email + cols.phone + cols.lang + 24,
  };
  const checkCols = [
    T("Info", "Infos", "Info"),
    T("Facturen", "Factures", "Invoices"),
    T("Vouchers", "Bons", "Vouchers"),
  ];
  const contactHead = () => {
    write(T("Voor- en achternaam", "Prénom et nom", "Full name"), colX.name, y - 7.5, 7.5, regular, MUT);
    write(T("E-mail", "E-mail", "Email"), colX.email, y - 7.5, 7.5, regular, MUT);
    write(T("Telefoon", "Téléphone", "Phone"), colX.phone, y - 7.5, 7.5, regular, MUT);
    write(T("Taal", "Langue", "Lang."), colX.lang, y - 7.5, 7.5, regular, MUT);
    checkCols.forEach((c, i) => {
      const w = regular.widthOfTextAtSize(winAnsi(c), 7.5);
      write(c, colX.checks + i * checkW + (checkW - w) / 2, y - 7.5, 7.5, regular, MUT);
    });
    y -= 11;
  };
  heading(
    T("Contactpersonen", "Personnes de contact", "Contact persons"),
    T(
      "Vink aan wie onze algemene informatie krijgt en wie de facturen. De vouchers en tickets gaan naar één persoon. Taal: NL, FR of EN.",
      "Cochez qui reçoit nos informations générales et qui reçoit les factures. Les bons et tickets vont à une seule personne. Langue : NL, FR ou EN.",
      "Tick who gets our general information and who gets the invoices. The vouchers and tickets go to one person. Language: NL, FR or EN.",
    ),
    11 + 2 * ROW,
  );
  contactHead();
  const voucherTo = voucherContact(sponsor);
  const receiver = form.createRadioGroup("voucher_receiver");
  for (let i = 0; i < rows; i++) {
    if (y - ROW < BOTTOM) {
      newPage();
      contactHead();
    }
    const c = contacts[i];
    const n = i + 1;
    textField(`contact${n}_name`, "", colX.name, y, cols.name, contactName(c), { size: 9 });
    textField(`contact${n}_email`, "", colX.email, y, cols.email, c?.email, { size: 9 });
    textField(`contact${n}_phone`, "", colX.phone, y, cols.phone, c?.phone, { size: 9 });
    textField(`contact${n}_language`, "", colX.lang, y, cols.lang, c ? (c.language || "nl").toUpperCase() : "", {
      size: 9,
    });
    const boxY = y - (FIELD_H + BOX) / 2;
    const boxX = (col: number) => colX.checks + col * checkW + (checkW - BOX) / 2;
    checkBox(`contact${n}_info`, boxX(0), boxY, !!c?.prefs?.info);
    checkBox(`contact${n}_invoices`, boxX(1), boxY, !!c?.prefs?.invoice);
    radio(receiver, `contact${n}`, boxX(2), boxY);
    if (c && voucherTo?.id === c.id) receiver.select(`contact${n}`);
    y -= ROW;
  }

  /* ================= 3. The formulas ================= */
  /* Cheapest first, so they read as a ladder — as in the agreement form. */
  const formulas = [...(edition.formulas || [])].sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  const choices: Choice[] = formulas.map((f, i) => ({
    key: `formula${i + 1}`,
    name: f.name,
    color: formulaColor(f),
    cost: f.cost,
    tickets: ticketLines(f, lang),
    visibility: visibilityLines(f, lang),
  }));
  /* An agreement already made for this edition comes ticked: on its formula
     when it still is that formula, or as an option of its own when it was
     set apart from it or made Op maat — so the sponsor sees what was agreed,
     not what the formula would have given. */
  let ticked = "";
  if (deal) {
    const own = formulas.find((f) => f.name === deal.formulaName);
    const asFormula = !!own && benefitChanges(deal, own).length === 0 && Number(deal.cost) === Number(own.cost);
    if (own && asFormula) ticked = choices[formulas.indexOf(own)].key;
    else {
      ticked = "agreement";
      choices.push({
        key: ticked,
        name: isCustom(deal)
          ? T("Op maat", "Sur mesure", "Custom")
          : `${deal.formulaName} ${T("(aangepast)", "(adaptée)", "(adjusted)")}`,
        color: own ? formulaColor(own) : NO_FORMULA_COLOR,
        cost: deal.cost,
        tickets: ticketLines({ ...deal, foodDrinkValue: 0, drinkVouchers: [] }, lang),
        visibility: visibilityLines(deal, lang),
      });
    }
  }

  const PAD = 9;
  const leftW = 150;
  const colsX = M + leftW + 14;
  const listW = (M + W - PAD - colsX - 14) / 2;
  const LEAD = 11.5;
  const blockOf = (c: Choice) => {
    const nameLines = wrap(c.name, bold, 11, leftW - BOX - 14);
    const lists = [c.tickets, c.visibility].map((lines) => lines.flatMap((l) => wrap(l, regular, 8.5, listW)));
    const left = nameLines.length * 13 + 14;
    const right = Math.max(...lists.map((l) => (l.length ? 12 + l.length * LEAD : 0)), LEAD);
    return { nameLines, lists, height: PAD * 2 + Math.max(left, right) };
  };
  const blocks = choices.map(blockOf);

  heading(
    T(`Uw formule voor ${edition.name}`, `Votre formule pour ${edition.name}`, `Your formula for ${edition.name}`),
    choices.length === 0
      ? T(
          "De formules voor deze editie liggen nog niet vast. Laat ons bij de opmerkingen weten wat u voor ogen hebt.",
          "Les formules de cette édition ne sont pas encore fixées. Dites-nous dans les remarques ce que vous envisagez.",
          "The formulas for this edition aren't set yet. Let us know in the remarks what you have in mind.",
        )
      : ticked
        ? T(
            "Duid één formule aan. Wat we al afspraken, staat aangeduid.",
            "Indiquez une formule. Ce dont nous avons déjà convenu est coché.",
            "Mark one formula. What we already agreed is marked.",
          )
        : T("Duid één formule aan.", "Indiquez une formule.", "Mark one formula."),
    blocks[0]?.height ?? 0,
  );
  const choice = choices.length ? form.createRadioGroup("formula") : null;
  const listHeads = [T("Tickets & vouchers", "Tickets & bons", "Tickets & vouchers"), T("Zichtbaarheid", "Visibilité", "Visibility")];
  choices.forEach((c, i) => {
    const b = blocks[i];
    need(b.height);
    const top = y;
    page.drawRectangle({ x: M, y: top - b.height, width: W, height: b.height, color: CARD });
    page.drawRectangle({ x: M, y: top - b.height, width: 4, height: b.height, color: hex(c.color) });
    radio(choice!, c.key, M + 14, top - PAD - 13 + 1);
    let ny = top - PAD - 11;
    b.nameLines.forEach((line) => {
      write(line, M + 14 + BOX + 7, ny, 11, bold, INK);
      ny -= 13;
    });
    write(eur(c.cost), M + 14 + BOX + 7, ny - 1, 9.5, bold, MUT);

    const empty = b.lists.every((l) => l.length === 0);
    if (empty) write("—", colsX, top - PAD - 9, 9, regular, MUT);
    b.lists.forEach((lines, col) => {
      if (!lines.length) return;
      const x = colsX + col * (listW + 14);
      write(listHeads[col], x, top - PAD - 7, 7.5, bold, MUT);
      lines.forEach((line, j) => write(line, x, top - PAD - 12 - 8.5 - j * LEAD, 8.5, regular, INK));
    });
    y -= b.height + 5;
  });
  if (choice && ticked) choice.select(ticked);

  /* Food & drink never comes with a formula (0027): a sponsor adds it on
     top, and it is added to what they pay. */
  const fdHint = T(
    "Eten- en drankvouchers komen bovenop uw formule. Vul de totale waarde in die u wenst; die wordt bij uw bijdrage geteld.",
    "Les bons food & boissons s'ajoutent à votre formule. Indiquez la valeur totale souhaitée ; elle s'ajoute à votre contribution.",
    "Food & drink vouchers come on top of your formula. Enter the total value you would like; it is added to your contribution.",
  );
  const fdW = 110;
  const fdLines = wrap(fdHint, regular, 8.5, W - fdW - 30);
  need(16 + Math.max(fdLines.length * 12, FIELD_H) + 6);
  y -= 6;
  write(T("Extra vouchers eten & drinken", "Bons food & boissons en plus", "Extra food & drink vouchers"), M, y - 9.5, 9.5, bold);
  y -= 15;
  fdLines.forEach((line, j) => write(line, M, y - 8.5 - j * 12, 8.5, regular, MUT));
  write("€", M + W - fdW - 12, y - FIELD_H / 2 - 3.5, 10, bold);
  const fd = Number(deal?.foodDrinkValue) || 0;
  textField(
    "food_drink_value",
    "",
    M + W - fdW,
    y,
    fdW,
    fd > 0 ? fd.toLocaleString(LOCALES[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
  );
  y -= Math.max(fdLines.length * 12, FIELD_H) + 4;

  /* ================= 4. Remarks ================= */
  const REMARKS_H = 58;
  heading(T("Opmerkingen", "Remarques", "Remarks"), "", REMARKS_H);
  textField("remarks", "", M, y, W, "", { height: REMARKS_H, multiline: true });
  y -= REMARKS_H + 4;

  /* ================= 5. Signature ================= */
  const SIGN_H = 46;
  heading(
    T("Handtekening", "Signature", "Signature"),
    T(
      "Ik bevestig de gegevens hierboven en de formule die ik aanduidde.",
      "Je confirme les données ci-dessus et la formule que j'ai indiquée.",
      "I confirm the details above and the formula I marked.",
    ),
    11 + SIGN_H,
  );
  const nameW = 200;
  const dateW = 100;
  textField("signed_by", T("Naam", "Nom", "Name"), M, y, nameW);
  textField("signed_on", T("Datum", "Date", "Date"), M + nameW + GAP, y, dateW);
  const signX = M + nameW + dateW + 2 * GAP;
  write(T("Handtekening", "Signature", "Signature"), signX, y - 7.5, 7.5, regular, MUT);
  page.drawRectangle({
    x: signX,
    y: y - 11 - SIGN_H,
    width: M + W - signX,
    height: SIGN_H,
    borderColor: SUB,
    borderWidth: 0.75,
    color: WHITE,
  });

  /* ----- footers, now that the pages are counted ----- */
  pages.forEach((p, i) => {
    page = p;
    write(`Grensrock · ${edition.name} · ${sponsor.companyName}`, M, 28, 7.5, regular, MUT);
    writeRight(`${i + 1} / ${pages.length}`, M + W, 28, 7.5, regular, MUT);
  });

  return doc.save();
}
