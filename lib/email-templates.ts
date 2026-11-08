import { benefitChanges, changeLines, isCustom } from "@/lib/benefits";
import { LED_ZONES, SETTLEMENTS, label } from "@/lib/constants";
import { contactName, primaryContact } from "@/lib/contacts";
import { renderEmailHtml } from "@/lib/email/layout";
import { dealTotalCost, eur, foodDrinkExtra, invoiceAmount, refRequiredFor } from "@/lib/money";
import { normFolder, normLed } from "@/lib/normalize";
import { userName } from "@/lib/users";
import { drinkPoolValue, voucherText } from "@/lib/vouchers";
import type { Contact, Deal, Edition, FormulaFields, Language, Sponsor, TeamLanguage, User } from "@/types";

/* ---------- portal invitation text ----------
   A personal note the team copies and sends themselves. It doesn't replace
   the email that switching on portal access sends (the link to choose a
   password); it tells the contact that email is coming and what to do with
   it. The button names quoted here are the sign-in page's own. */
export function buildInvitation(
  sponsor: Sponsor,
  contact: Contact | null | undefined,
  appUrl: string,
  responsible?: string,
) {
  const c = contact || primaryContact(sponsor) || ({} as Partial<Contact>);
  const lang: Language = c.language || "nl";
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  return B(
    `Beste ${contactName(c) || sponsor.companyName},

Via onze sponsortool kan u de gegevens van ${sponsor.companyName} voor Grensrock zelf nakijken en aanpassen, en uw logo opladen (voor de folder, ledboarding, website, ...).

Link: ${appUrl}

U krijgt van ons een e-mail met een link om een wachtwoord te kiezen. Daarna meldt u zich aan met uw e-mailadres (${c.email || "het adres dat wij van u hebben"}) en dat wachtwoord.
Liever zonder wachtwoord? Kies op de aanmeldpagina "Stuur me een aanmeldlink"; die link meldt u meteen aan.
Geen e-mail gekregen, of is de link verlopen? Kies dan "Wachtwoord vergeten of nog geen wachtwoord?".

Alvast bedankt!
${responsible || "Het Grensrock-team"}`,
    `Cher/Chère ${contactName(c) || sponsor.companyName},

Via notre outil sponsors, vous pouvez vérifier et modifier vous-même les données de ${sponsor.companyName} pour Grensrock, et télécharger votre logo (pour le dépliant, le ledboarding, le site web, ...).

Lien : ${appUrl}

Vous recevrez de notre part un e-mail avec un lien pour choisir un mot de passe. Ensuite, connectez-vous avec votre adresse e-mail (${c.email || "l'adresse que nous avons"}) et ce mot de passe.
Vous préférez vous passer de mot de passe ? Choisissez « Envoyez-moi un lien de connexion » sur la page de connexion ; ce lien vous connecte directement.
Pas reçu d'e-mail, ou le lien a expiré ? Choisissez alors « Mot de passe oublié, ou pas encore de mot de passe ? ».

Merci d'avance !
${responsible || "L'équipe Grensrock"}`,
    `Dear ${contactName(c) || sponsor.companyName},

Through our sponsor tool you can review and update ${sponsor.companyName}'s details for Grensrock yourself, and upload your logo (for the folder, LED boarding, website, ...).

Link: ${appUrl}

You'll get an email from us with a link to choose a password. After that, sign in with your email address (${c.email || "the address we have on file"}) and that password.
Rather not use a password? Choose "Send me a sign-in link" on the sign-in page; that link signs you straight in.
No email, or has the link expired? Then choose "Forgot your password, or don't have one yet?".

Thank you!
${responsible || "The Grensrock team"}`,
  );
}

/* ---------- Email / contract templates ---------- */

export function buildEmail(
  deal: Deal,
  sponsor: Sponsor,
  edition: Edition,
  contact?: Contact | Contact[] | null,
  acceptUrl?: string,
): { subject: string; body: string; lang: Language } {
  /* One text goes to everyone it is addressed to, so the recipients are taken
     as a list: the language and the "your address" line follow the first, and
     the greeting names all of them. "Beste Jan" arriving in Piet's inbox reads
     as a mail meant for someone else, which is the wrong first impression for
     something that serves as the contract. */
  const people = (Array.isArray(contact) ? contact : contact ? [contact] : []).filter(Boolean) as Contact[];
  const c = people[0] || primaryContact(sponsor) || ({} as Partial<Contact>);
  const lang: Language = c.language || "nl";
  const benefits: string[] = [];
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  const names = people.map((x) => contactName(x)).filter(Boolean);
  const addressee = names.length
    ? names.length > 1
      ? `${names.slice(0, -1).join(", ")}${B(" en ", " et ", " and ")}${names[names.length - 1]}`
      : names[0]
    : contactName(c) || sponsor.companyName;

  if (Number(deal.vipFriday) > 0)
    benefits.push(
      B(
        `${deal.vipFriday} VIP-tickets vrijdag`,
        `${deal.vipFriday} tickets VIP vendredi`,
        `${deal.vipFriday} VIP tickets Friday`,
      ),
    );
  if (Number(deal.vipSaturday) > 0)
    benefits.push(
      B(
        `${deal.vipSaturday} VIP-tickets zaterdag`,
        `${deal.vipSaturday} tickets VIP samedi`,
        `${deal.vipSaturday} VIP tickets Saturday`,
      ),
    );
  if (Number(deal.vipGuests) > 0)
    benefits.push(
      B(
        `${deal.vipGuests} VIP-tickets voor genodigden`,
        `${deal.vipGuests} tickets VIP pour invités`,
        `${deal.vipGuests} VIP tickets for guests`,
      ),
    );
  if (Number(deal.drinkValue) > 0) {
    const dvt = voucherText(deal.drinkVouchers);
    const split = dvt ? B(`, verdeeld in: ${dvt}`, `, répartis en : ${dvt}`, `, divided into: ${dvt}`) : "";
    benefits.push(
      B(
        `Drankvouchers ter waarde van ${eur(drinkPoolValue(deal))}${split}`,
        `Bons boissons d'une valeur de ${eur(drinkPoolValue(deal))}${split}`,
        `Drink vouchers worth ${eur(drinkPoolValue(deal))}${split}`,
      ),
    );
  }
  if (Number(deal.foodDrinkValue) > 0) {
    const vt = voucherText(deal.foodDrinkVouchers);
    const split = vt
      ? B(`, verdeeld in vouchers: ${vt}`, `, répartis en bons : ${vt}`, `, divided into vouchers: ${vt}`)
      : "";
    benefits.push(
      B(
        `Vouchers eten & drinken ter waarde van ${eur(deal.foodDrinkValue)}${split}`,
        `Bons food & boissons d'une valeur de ${eur(deal.foodDrinkValue)}${split}`,
        `Food & drink vouchers worth ${eur(deal.foodDrinkValue)}${split}`,
      ),
    );
  }
  const folder = normFolder(deal.folderMention);
  if (folder !== "none") {
    const size = {
      full: B("volledige pagina", "page entière", "full page"),
      half: B("halve pagina", "demi-page", "half page"),
      quarter: B("1/4 pagina", "1/4 de page", "1/4 page"),
      eighth: B("1/8 pagina", "1/8 de page", "1/8 page"),
    }[folder];
    benefits.push(
      B(
        `Vermelding in de festivalfolder (${size})`,
        `Mention dans le dépliant du festival (${size})`,
        `Mention in the festival folder (${size})`,
      ),
    );
  }
  if (deal.websiteMention !== "none")
    benefits.push(
      deal.websiteMention === "logo"
        ? B("Logo op de website", "Logo sur le site web", "Logo on the website")
        : B("Naamsvermelding op de website", "Mention du nom sur le site web", "Name mention on the website"),
    );
  if (deal.posterMention && deal.posterMention !== "none")
    benefits.push(
      deal.posterMention === "logo"
        ? B("Logo op de festivalaffiche", "Logo sur l'affiche du festival", "Logo on the festival poster")
        : B(
            "Naamsvermelding op de festivalaffiche",
            "Mention du nom sur l'affiche du festival",
            "Name mention on the festival poster",
          ),
    );
  /* "banner(s)" reads the same in all three languages */
  if (Number(deal.fenceCovers) > 0)
    benefits.push(`${deal.fenceCovers} banner${Number(deal.fenceCovers) === 1 ? "" : "s"}`);
  const zones = normLed(deal.ledboarding);
  if (zones.length > 0) {
    const zoneList = zones.map((z) => label(LED_ZONES, z, lang)).join(" + ");
    benefits.push(
      B(
        `Vermelding op ledboarding (${zoneList})`,
        `Mention sur le ledboarding (${zoneList})`,
        `Mention on LED boarding (${zoneList})`,
      ),
    );
  }

  const list = benefits.map((b) => "  • " + b).join("\n");
  const dates = edition.startDate ? ` (${edition.startDate}${edition.endDate ? " – " + edition.endDate : ""})` : "";
  const notes = (deal.notes || "").trim();

  /* Contribution + settlement wording */
  const inKind = (deal.inKindDescription || "").trim();
  const toInvoice = invoiceAmount(deal);
  /* The total, with the food & drink vouchers bought on top spelled out:
     € 500 formula + € 100 vouchers is a contribution of € 600. */
  const total = eur(dealTotalCost(deal));
  const fd = foodDrinkExtra(deal);
  const contribution =
    fd > 0
      ? B(
          `Bijdrage: ${total} (${eur(deal.cost)} formule + ${eur(fd)} vouchers eten & drinken)`,
          `Contribution : ${total} (${eur(deal.cost)} formule + ${eur(fd)} bons food & boissons)`,
          `Contribution: ${total} (${eur(deal.cost)} formula + ${eur(fd)} food & drink vouchers)`,
        )
      : B(`Bijdrage: ${total}`, `Contribution : ${total}`, `Contribution: ${total}`);
  const ref = String(deal.invoiceReference || "").trim();
  const refLine = refRequiredFor(deal, sponsor)
    ? ref
      ? B(
          `\nReferentie op de factuur: ${ref}`,
          `\nRéférence sur la facture : ${ref}`,
          `\nReference on the invoice: ${ref}`,
        )
      : B(
          "\nGelieve ons de referentie te bezorgen die op de factuur moet komen.",
          "\nMerci de nous communiquer la référence à mentionner sur la facture.",
          "\nPlease let us know the reference to put on the invoice.",
        )
    : "";
  let settlementBlock: string;
  if (deal.settlement === "inkind" && toInvoice === 0) {
    settlementBlock = B(
      `Deze sponsoring gebeurt in natura${inKind ? `:\n${inKind}` : "."}
Er wordt hiervoor geen factuur opgemaakt.`,
      `Ce sponsoring se fait en nature${inKind ? ` :\n${inKind}` : "."}
Aucune facture ne sera établie pour cet accord.`,
      `This sponsorship is provided in kind${inKind ? `:\n${inKind}` : "."}
No invoice will be issued for this agreement.`,
    );
  } else if (deal.settlement === "inkind" || deal.settlement === "mixed") {
    settlementBlock = B(
      `Een deel van deze sponsoring gebeurt in natura${inKind ? `:\n${inKind}` : "."}
Te factureren bedrag: ${eur(toInvoice)}. De facturatie volgt via e-invoicing (BillToBox).${refLine}`,
      `Une partie de ce sponsoring se fait en nature${inKind ? ` :\n${inKind}` : "."}
Montant à facturer : ${eur(toInvoice)}. La facturation suivra par e-invoicing (BillToBox).${refLine}`,
      `Part of this sponsorship is provided in kind${inKind ? `:\n${inKind}` : "."}
Amount to be invoiced: ${eur(toInvoice)}. Invoicing will follow via e-invoicing (BillToBox).${refLine}`,
    );
  } else {
    settlementBlock = B(
      `De facturatie volgt via e-invoicing (BillToBox).${refLine}`,
      `La facturation suivra par e-invoicing (BillToBox).${refLine}`,
      `Invoicing will follow via e-invoicing (BillToBox).${refLine}`,
    );
  }

  /* Accepting in the portal records who accepted, when, and a frozen copy of
     the terms (accept_deal, 0004_rpc.sql). A replied "akkoord" records none of
     that, so it stays the wording only when there is no link to offer — a
     deployment with no portal URL to point at, or a preview of the text. */
  const confirm = acceptUrl
    ? B(
        `Dit overzicht geldt als contract. U bevestigt het via deze persoonlijke link, die u meteen aanmeldt in het sponsorportaal:
${acceptUrl}

Kies daar bij "Sponsoring" voor "Lezen en aanvaarden". De link werkt 14 dagen en is enkel voor u bedoeld — stuur hem dus niet door. Is hij verlopen, vraag dan op de aanmeldpagina een nieuwe link aan.`,
        `Cet aperçu fait office de contrat. Vous le confirmez via ce lien personnel, qui vous connecte directement au portail sponsors :
${acceptUrl}

Choisissez ensuite « Lire et accepter » sous « Sponsoring ». Le lien est valable 14 jours et vous est personnel — ne le transférez donc pas. S'il a expiré, demandez un nouveau lien sur la page de connexion.`,
        `This overview serves as the contract. You confirm it through this personal link, which signs you straight into the sponsor portal:
${acceptUrl}

There, choose "Read and accept" under "Sponsoring". The link works for 14 days and is meant for you only — please don't forward it. If it has expired, request a new link from the sign-in page.`,
      )
    : B(
        'Dit overzicht geldt als contract. Gelieve dit ter bevestiging te beantwoorden met "akkoord".',
        "Cet aperçu fait office de contrat. Veuillez répondre « accord » pour confirmation.",
        'This overview serves as the contract. Please reply "agreed" to confirm.',
      );

  const subject = B(
    `Bevestiging sponsorovereenkomst ${edition.name}`,
    `Confirmation de l'accord de sponsoring ${edition.name}`,
    `Confirmation of sponsorship agreement ${edition.name}`,
  );

  const body = B(
    `Beste ${addressee},

Hartelijk dank voor uw steun aan ${edition.name}${dates}. Hieronder vindt u een overzicht van de afgesproken sponsorformule${deal.formulaName ? ` "${deal.formulaName}"` : ""}.

Sponsor: ${sponsor.companyName}
BTW-nummer: ${sponsor.vatNumber || "—"}
${contribution}

Inbegrepen:
${list || "  • (geen voordelen geselecteerd)"}
${notes ? "\nOpmerkingen:\n" + notes + "\n" : ""}
Facturatie:
${settlementBlock}

${confirm}

Met vriendelijke groeten,
${deal.responsible || "Het Grensrock-team"}
Grensrock`,
    `Cher/Chère ${addressee},

Merci beaucoup pour votre soutien à ${edition.name}${dates}. Vous trouverez ci-dessous un aperçu de la formule de sponsoring convenue${deal.formulaName ? ` « ${deal.formulaName} »` : ""}.

Sponsor : ${sponsor.companyName}
Numéro de TVA : ${sponsor.vatNumber || "—"}
${contribution}

Inclus :
${list || "  • (aucun avantage sélectionné)"}
${notes ? "\nRemarques :\n" + notes + "\n" : ""}
Facturation :
${settlementBlock}

${confirm}

Cordialement,
${deal.responsible || "L'équipe Grensrock"}
Grensrock`,
    `Dear ${addressee},

Thank you very much for supporting ${edition.name}${dates}. Below you will find an overview of the agreed sponsorship formula${deal.formulaName ? ` "${deal.formulaName}"` : ""}.

Sponsor: ${sponsor.companyName}
VAT number: ${sponsor.vatNumber || "—"}
${contribution}

Included:
${list || "  • (no benefits selected)"}
${notes ? "\nNotes:\n" + notes + "\n" : ""}
Invoicing:
${settlementBlock}

${confirm}

Kind regards,
${deal.responsible || "The Grensrock team"}
Grensrock`,
  );

  return { subject, body, lang };
}

/* ---------- the agreement, laid out ----------
   Built from the text rather than beside buildEmail, because the text is
   what the team may edit before it goes out: the preview and the route
   both lay out the approved text through here, so what the modal shows is
   what arrives. `acceptUrl` is the link as it stands in that text — the
   bare one in the preview, a recipient's personal one in their copy. */
export function renderAgreementHtml(body: string, subject: string, lang: Language, acceptUrl?: string) {
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  return renderEmailHtml({
    text: body,
    lang,
    heading: subject,
    buttons: acceptUrl
      ? { [acceptUrl]: B("Overeenkomst bekijken en aanvaarden", "Consulter et accepter l'accord", "Review and accept the agreement") }
      : {},
  });
}

/* ---------- team invitation text ----------
   In the account's own language (NL/EN, like buildAccessGranted below).
   Team members sign in with Google; there is no password of theirs to
   mention. Two ways out: copied from the Team tab and sent by hand
   (buildUserInvite), or mailed by app/api/team/invite the moment an admin
   adds the account (buildTeamAccountAdded), which also names that admin.

   The text is shaped for lib/email/layout.ts, which lays the mailed copy
   out like every sponsor mail: the account and role lines become the
   summary card, and the link alone on its line becomes the button. Read
   as plain text — pasted by hand, or in a client without HTML — the same
   shape is just a short message. */
export function buildUserInvite(user: User, appUrl: string) {
  return teamInviteBody(user, appUrl, null);
}

export function buildTeamAccountAdded(user: User, addedBy: User | null | undefined, appUrl: string) {
  const en = user.language === "en";
  const subject = en ? "You have access to the Grensrock sponsor tool" : "U hebt toegang tot de Grensrock-sponsortool";
  const body = teamInviteBody(user, appUrl, addedBy);
  const html = teamEmailHtml(body, en, en ? "Welcome to the sponsor tool" : "Welkom in de sponsortool", appUrl);
  return { subject, body, html };
}

/* The house layout, dressed for the team: the line under the logo is the
   app's own (hd.subtitle), as the sponsor mails carry the portal's, and the
   link to the app is the button. */
function teamEmailHtml(body: string, en: boolean, heading: string, appUrl?: string) {
  return renderEmailHtml({
    text: body,
    lang: en ? "en" : "nl",
    kicker: en ? "Sponsor management" : "Sponsorbeheer",
    heading,
    buttons: appUrl ? { [appUrl]: en ? "Open the sponsor tool" : "Open de sponsortool" } : {},
  });
}

const teamRole = (user: User, en: boolean) =>
  en
    ? user.role === "admin"
      ? "admin — everything, including editions, invoicing and team accounts"
      : "user — view and update sponsors and agreements"
    : user.role === "admin"
      ? "admin — alles, inclusief edities, facturatie en teamaccounts"
      : "user — sponsors en overeenkomsten bekijken en bijwerken";

function teamInviteBody(user: User, appUrl: string, addedBy: User | null | undefined) {
  const by = addedBy ? userName(addedBy) : null;
  if (user.language === "en") {
    return `Hi ${userName(user)},

${by ? `${by} has given you access to the Grensrock sponsor tool.` : "You have access to the Grensrock sponsor tool."}

Google account: ${user.email}
Role: ${teamRole(user, true)}

Sign in with that account using "Sign in with Google". There is no separate password for the tool.

${appUrl}

Grensrock`;
  }
  return `Dag ${userName(user)},

${by ? `${by} heeft u toegang gegeven tot de Grensrock-sponsortool.` : "U hebt toegang tot de Grensrock-sponsortool."}

Google-account: ${user.email}
Rol: ${teamRole(user, false)}

Meld u met dat account aan via "Aanmelden met Google". Een apart wachtwoord voor de tool is er niet.

${appUrl}

Grensrock`;
}

/* ---------- team access granted ----------
   Sent to a @grensrock.be account after an admin turns their registration
   into access (see 0011_team_access_approval.sql). Shaped like the
   invitation above, so it lays out the same way: the account and role as
   the summary card, the link as the button. Team accounts are NL/EN only —
   unlike sponsor contacts, there is no French here. */
export function buildAccessGranted(user: User, grantedBy?: User | null, appUrl?: string) {
  const nl = user.language !== "en";
  const link = appUrl || "[link naar de sponsortool]";
  const by = grantedBy ? userName(grantedBy) : null;

  const subject = nl
    ? "U hebt toegang tot de Grensrock-sponsortool"
    : "You now have access to the Grensrock sponsor tool";

  /* The whole sentence branches, not just its opening: Dutch moves the verb
     when the approver is named, and English needs one at all when they aren't. */
  const openedNl = by
    ? `${by} heeft uw toegang tot de Grensrock-sponsortool goedgekeurd.`
    : "Uw toegang tot de Grensrock-sponsortool is goedgekeurd.";
  const openedEn = by
    ? `${by} has approved your access to the Grensrock sponsor tool.`
    : "Your access to the Grensrock sponsor tool has been approved.";

  const body = nl
    ? `Dag ${userName(user)},

${openedNl}

Google-account: ${user.email}
Rol: ${teamRole(user, false)}

Meld u met dat account aan via "Aanmelden met Google". Als u nog aangemeld was, meldt u zich best even af en opnieuw aan.

${link}

Grensrock`
    : `Hi ${userName(user)},

${openedEn}

Google account: ${user.email}
Role: ${teamRole(user, true)}

Sign in with that account using "Sign in with Google". If you were still signed in, sign out and back in once.

${link}

Grensrock`;

  const html = teamEmailHtml(body, !nl, nl ? "Uw toegang is goedgekeurd" : "Your access has been approved", appUrl);

  return { subject, body, html };
}
/* ---------- new agreement, for the admins ----------
   Sent to each admin when an agreement is created — by a team member in
   the app, or by a sponsor picking a formula in the portal — so a new one
   doesn't have to be spotted in the list. Team-facing, so NL/EN in the
   admin's own language, like buildAccessGranted above.

   A team member who set the benefits apart from the formula, or made the
   agreement Op maat, leaves it waiting for an admin (0026, 0028), and then
   that is what the mail is for. It says so first — in the subject, and at the top of the text with
   each difference on a line — so it can't be read as just another new
   agreement. */
type AdminDeal = Pick<Deal, "formulaName" | "cost" | "settlement"> & Partial<Deal>;

/* `formula` is what the benefits are held against: null for Op maat, or a
   formula the edition doesn't have (any more). Op maat waits even with no
   benefits at all, for its price (0028). */
function approvalBlock(lang: TeamLanguage, deal: AdminDeal, formula: FormulaFields | null) {
  const nl = lang === "nl";
  const custom = !formula && isCustom(deal);
  const lines = changeLines(benefitChanges(deal, formula, lang))
    .map((l) => `• ${l}`)
    .join("\n");
  const head = formula
    ? nl
      ? `⚠ GOEDKEURING NODIG — de voordelen wijken af van formule ${deal.formulaName}`
      : `⚠ APPROVAL NEEDED — the benefits differ from formula ${deal.formulaName}`
    : custom
      ? nl
        ? "⚠ GOEDKEURING NODIG — overeenkomst op maat"
        : "⚠ APPROVAL NEEDED — custom agreement (Op maat)"
      : nl
        ? "⚠ GOEDKEURING NODIG — deze overeenkomst volgt geen formule"
        : "⚠ APPROVAL NEEDED — this agreement follows no formula";
  const intro = formula
    ? nl
      ? `Formule ${deal.formulaName} → deze overeenkomst:`
      : `Formula ${deal.formulaName} → this agreement:`
    : custom
      ? nl
        ? `Een admin keurt elke overeenkomst op maat goed: de bijdrage van ${eur(deal.cost)} en de voordelen. ${lines ? "Die zijn met de hand ingevuld:" : "Ze geeft geen voordelen."}`
        : `An admin approves every Op maat agreement: the contribution of ${eur(deal.cost)} and the benefits. ${lines ? "These were filled in by hand:" : "It gives no benefits."}`
      : nl
        ? "Alle voordelen zijn met de hand ingevuld:"
        : "Every benefit was filled in by hand:";
  const then = nl
    ? "De sponsor krijgt deze overeenkomst pas nadat een admin dit goedkeurt. In de app vindt u ze onder Overeenkomsten → Wacht op goedkeuring."
    : "The sponsor only gets this agreement once an admin approves this. In the app you'll find it under Agreements → Waiting for approval.";
  return `${head}\n\n${intro}${lines ? `\n${lines}` : ""}\n\n${then}`;
}

function agreementFacts(lang: TeamLanguage, deal: AdminDeal, sponsorName: string, editionName: string) {
  const nl = lang === "nl";
  const formula = isCustom(deal) ? (nl ? "op maat" : "custom") : deal.formulaName;
  return nl
    ? `Sponsor: ${sponsorName}
Editie: ${editionName}
Formule: ${formula}
Bijdrage: ${eur(dealTotalCost(deal))}
Afrekening: ${label(SETTLEMENTS, deal.settlement, lang)}`
    : `Sponsor: ${sponsorName}
Edition: ${editionName}
Formula: ${formula}
Contribution: ${eur(dealTotalCost(deal))}
Settlement: ${label(SETTLEMENTS, deal.settlement, lang)}`;
}

export function buildAgreementCreated(
  admin: User,
  deal: AdminDeal,
  sponsorName: string,
  editionName: string,
  createdBy: { name: string; viaPortal: boolean },
  appUrl: string,
  /** Set when the agreement waits for an admin's approval of its benefits. */
  waiting?: { formula: FormulaFields | null } | null,
) {
  const lang: TeamLanguage = admin.language === "en" ? "en" : "nl";
  const nl = lang === "nl";
  const by = createdBy.viaPortal
    ? nl
      ? `${createdBy.name || "de sponsor"}, via het sponsorportaal`
      : `${createdBy.name || "the sponsor"}, via the sponsor portal`
    : createdBy.name || (nl ? "een teamlid" : "a team member");

  const subject = waiting
    ? nl
      ? `Goedkeuring nodig: nieuwe overeenkomst ${sponsorName} (${editionName})`
      : `Approval needed: new agreement ${sponsorName} (${editionName})`
    : nl
      ? `Nieuwe overeenkomst: ${sponsorName} (${editionName})`
      : `New agreement: ${sponsorName} (${editionName})`;

  const review = waiting ? `\n\n${approvalBlock(lang, deal, waiting.formula)}` : "";

  const body = nl
    ? `Dag ${userName(admin)},

Er is een nieuwe overeenkomst aangemaakt.${review}

${agreementFacts(lang, deal, sponsorName, editionName)}
Aangemaakt door: ${by}

Link: ${appUrl}

Grensrock`
    : `Hi ${userName(admin)},

A new agreement has been created.${review}

${agreementFacts(lang, deal, sponsorName, editionName)}
Created by: ${by}

Link: ${appUrl}

Grensrock`;

  return { subject, body };
}

/* ---------- changed benefits on an existing agreement, for the admins ----------
   The same wait as above, when the benefits are changed on an agreement
   that already existed — one a sponsor requested in the portal and the
   team confirms, or one that was already sent. Op maat waits again on a
   new price alone, so for it the mail speaks of the agreement, not just
   its benefits. */
export function buildBenefitsChanged(
  admin: User,
  deal: AdminDeal,
  sponsorName: string,
  editionName: string,
  changedBy: string,
  formula: FormulaFields | null,
  appUrl: string,
) {
  const lang: TeamLanguage = admin.language === "en" ? "en" : "nl";
  const nl = lang === "nl";
  const by = changedBy || (nl ? "Een teamlid" : "A team member");
  const custom = !formula && isCustom(deal);

  const subject = custom
    ? nl
      ? `Goedkeuring nodig: overeenkomst op maat aangepast voor ${sponsorName} (${editionName})`
      : `Approval needed: custom agreement changed for ${sponsorName} (${editionName})`
    : nl
      ? `Goedkeuring nodig: voordelen aangepast voor ${sponsorName} (${editionName})`
      : `Approval needed: benefits changed for ${sponsorName} (${editionName})`;

  const body = nl
    ? `Dag ${userName(admin)},

${by} ${custom ? "paste een bestaande overeenkomst aan (formule: op maat)." : "paste de voordelen van een bestaande overeenkomst aan."}

${approvalBlock(lang, deal, formula)}

${agreementFacts(lang, deal, sponsorName, editionName)}

Link: ${appUrl}

Grensrock`
    : `Hi ${userName(admin)},

${by} ${custom ? "changed an existing agreement (formula: Op maat)." : "changed the benefits of an existing agreement."}

${approvalBlock(lang, deal, formula)}

${agreementFacts(lang, deal, sponsorName, editionName)}

Link: ${appUrl}

Grensrock`;

  return { subject, body };
}

/* ---------- sponsor portal: set a password ----------
   Sent when a contact is given portal access, and again whenever they ask
   for a new link from the login form. The same message serves both: to the
   person reading it, "here is your access" and "I couldn't get in" have the
   same answer, and one wording is one thing to keep right. Sponsor-facing,
   so NL/FR/EN and the formal register the other sponsor templates use. */
export function buildPortalPasswordLink(
  contact: Pick<Contact, "firstName" | "lastName" | "email" | "language">,
  url: string,
  expiresAt: Date,
) {
  const lang: Language = contact.language || "nl";
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  const until = expiresAt.toLocaleDateString(
    { nl: "nl-BE", fr: "fr-BE", en: "en-GB" }[lang],
    { day: "numeric", month: "long", year: "numeric" },
  );
  const name = contactName(contact);

  const subject = B(
    "Stel uw wachtwoord in voor het Grensrock-sponsorportaal",
    "Définissez votre mot de passe pour le portail sponsors de Grensrock",
    "Set your password for the Grensrock sponsor portal",
  );

  const body = B(
    `Beste ${name || "sponsor"},

U hebt toegang tot het Grensrock-sponsorportaal. Daar kan u uw bedrijfsgegevens nakijken, uw logo opladen en uw tickets en vouchers verdelen.

Kies eerst een wachtwoord via deze link:
${url}

De link werkt tot ${until}. Daarna vraagt u op de aanmeldpagina gewoon een nieuwe aan.

Nadien meldt u zich aan met uw e-mailadres (${contact.email}) en het wachtwoord dat u koos.

Grensrock`,
    `Cher/Chère ${name || "sponsor"},

Vous avez accès au portail sponsors de Grensrock. Vous pouvez y vérifier les données de votre entreprise, télécharger votre logo et répartir vos tickets et bons.

Choisissez d'abord un mot de passe via ce lien :
${url}

Le lien est valable jusqu'au ${until}. Passé ce délai, demandez-en simplement un nouveau sur la page de connexion.

Ensuite, connectez-vous avec votre adresse e-mail (${contact.email}) et le mot de passe choisi.

Grensrock`,
    `Dear ${name || "sponsor"},

You have access to the Grensrock sponsor portal, where you can check your company details, upload your logo, and divide your tickets and vouchers.

First choose a password using this link:
${url}

The link works until ${until}. After that, just request a new one from the sign-in page.

Then sign in with your email address (${contact.email}) and the password you chose.

Grensrock`,
  );

  const html = renderEmailHtml({
    text: body,
    lang,
    heading: B("Kies uw wachtwoord", "Choisissez votre mot de passe", "Choose your password"),
    buttons: { [url]: B("Wachtwoord kiezen", "Choisir un mot de passe", "Choose a password") },
  });

  return { subject, body, html };
}

/* ---------- sponsor portal: sign in with a link ----------
   The other way in, beside the password. Sent only when the contact asked
   for it from the login form, so it opens with that rather than with a
   greeting about access they already knew they had.

   Short-lived on purpose, and said out loud: a link that quietly stopped
   working would read as "the portal is broken" rather than "ask for
   another one". The lifetime is Supabase's (see lib/auth/portal-magic-link),
   so it arrives here as minutes rather than as a date we'd be inventing. */
export function buildPortalSignInLink(
  contact: Pick<Contact, "firstName" | "lastName" | "email" | "language">,
  url: string,
  minutes: number,
) {
  const lang: Language = contact.language || "nl";
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  const name = contactName(contact);

  const subject = B(
    "Uw aanmeldlink voor het Grensrock-sponsorportaal",
    "Votre lien de connexion au portail sponsors de Grensrock",
    "Your sign-in link for the Grensrock sponsor portal",
  );

  const body = B(
    `Beste ${name || "sponsor"},

U vroeg een aanmeldlink aan voor het Grensrock-sponsorportaal. Klik hieronder en u bent meteen binnen — een wachtwoord hebt u niet nodig.

${url}

De link blijft ${minutes} minuten geldig en werkt één keer. Is hij vervallen, vraag er dan gerust een nieuwe aan op de aanmeldpagina.

Vroeg u niets aan? Dan hoeft u niets te doen. Zonder deze link verandert er niets aan uw account, en uw wachtwoord (als u er een hebt) blijft gewoon werken.

Grensrock`,
    `Cher/Chère ${name || "sponsor"},

Vous avez demandé un lien de connexion au portail sponsors de Grensrock. Cliquez ci-dessous et vous y serez directement — aucun mot de passe n'est nécessaire.

${url}

Le lien reste valable ${minutes} minutes et ne fonctionne qu'une seule fois. S'il a expiré, demandez-en simplement un nouveau sur la page de connexion.

Vous n'avez rien demandé ? Vous n'avez rien à faire. Sans ce lien, rien ne change à votre compte, et votre mot de passe (si vous en avez un) continue de fonctionner.

Grensrock`,
    `Dear ${name || "sponsor"},

You asked for a sign-in link to the Grensrock sponsor portal. Follow the link below and you're straight in — no password needed.

${url}

The link stays valid for ${minutes} minutes and works once. If it has expired, just ask for a new one from the sign-in page.

Didn't ask for this? Then there's nothing to do. Without the link nothing about your account changes, and your password (if you have one) keeps working.

Grensrock`,
  );

  const html = renderEmailHtml({
    text: body,
    lang,
    heading: B("Uw aanmeldlink", "Votre lien de connexion", "Your sign-in link"),
    buttons: { [url]: B("Aanmelden", "Se connecter", "Sign in") },
  });

  return { subject, body, html };
}
