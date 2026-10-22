import { LED_ZONES, OP_MAAT, SETTLEMENTS, label } from "@/lib/constants";
import { contactName, primaryContact } from "@/lib/contacts";
import { renderEmailHtml } from "@/lib/email/layout";
import { eur, invoiceAmount, refRequiredFor } from "@/lib/money";
import { normFolder, normLed } from "@/lib/normalize";
import { userName } from "@/lib/users";
import { drinkPoolValue, voucherText } from "@/lib/vouchers";
import type { Contact, Deal, Edition, Language, Sponsor, User } from "@/types";

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
        `Drankbonnen ter waarde van ${eur(drinkPoolValue(deal))}${split}`,
        `Bons boissons d'une valeur de ${eur(drinkPoolValue(deal))}${split}`,
        `Drink vouchers worth ${eur(drinkPoolValue(deal))}${split}`,
      ),
    );
  }
  if (Number(deal.foodDrinkValue) > 0) {
    const vt = voucherText(deal.foodDrinkVouchers);
    const split = vt
      ? B(`, verdeeld in bonnen: ${vt}`, `, répartis en bons : ${vt}`, `, divided into vouchers: ${vt}`)
      : "";
    benefits.push(
      B(
        `Bonnen eten & drinken ter waarde van ${eur(deal.foodDrinkValue)}${split}`,
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
  if (Number(deal.fenceCovers) > 0)
    benefits.push(
      B(
        `${deal.fenceCovers} hoes(sen) voor nadar- of Heras-hekken`,
        `${deal.fenceCovers} housse(s) pour barrières Nadar ou clôtures Heras`,
        `${deal.fenceCovers} cover(s) for Nadar barriers or Heras fences`,
      ),
    );
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
  /* NOTE: the prototype's Dutch line referenced `contribution` inside its own
     initialiser (a TDZ self-reference that threw at runtime, so this template
     could never be produced). Restored to the obvious intent, matching the FR/EN
     lines below. */
  const contribution = B(
    `Bijdrage: ${eur(deal.cost)}`,
    `Contribution : ${eur(deal.cost)}`,
    `Contribution: ${eur(deal.cost)}`,
  );
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
  if (deal.settlement === "inkind") {
    settlementBlock = B(
      `Deze sponsoring gebeurt in natura${inKind ? `:\n${inKind}` : "."}
Er wordt hiervoor geen factuur opgemaakt.`,
      `Ce sponsoring se fait en nature${inKind ? ` :\n${inKind}` : "."}
Aucune facture ne sera établie pour cet accord.`,
      `This sponsorship is provided in kind${inKind ? `:\n${inKind}` : "."}
No invoice will be issued for this agreement.`,
    );
  } else if (deal.settlement === "mixed") {
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
   Copied from the Team tab and sent by hand, in the account's own language
   (NL/EN, like buildAccessGranted below). Team members sign in with Google;
   there is no password of theirs to mention. */
export function buildUserInvite(user: User, appUrl: string) {
  if (user.language === "en") {
    return `Hi ${userName(user)},

You have access to the Grensrock sponsor tool.

Link: ${appUrl}
Sign in with your Google account (${user.email}) using "Sign in with Google". There is no separate password for the tool.
Your role: ${user.role === "admin" ? "admin — everything, including editions, invoicing and team accounts" : "user — view and update sponsors and agreements"}

Grensrock`;
  }
  return `Dag ${userName(user)},

U hebt toegang tot de Grensrock-sponsortool.

Link: ${appUrl}
Meld u aan met uw Google-account (${user.email}) via "Aanmelden met Google". Een apart wachtwoord voor de tool is er niet.
Uw rol: ${user.role === "admin" ? "admin — alles, inclusief edities, facturatie en teamaccounts" : "user — sponsors en overeenkomsten bekijken en bijwerken"}

Grensrock`;
}

/* ---------- team access granted ----------
   Sent to a @grensrock.be account after an admin turns their registration
   into access (see 0011_team_access_approval.sql). Plain text and free of
   any transport detail, so the same builder serves whichever way it ends
   up being sent. Team accounts are NL/EN only — unlike sponsor contacts,
   there is no French here. */
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

Link: ${link}
Meld u aan met uw Grensrock-account (${user.email}) via "Aanmelden met Google".
Uw rol: ${user.role === "admin" ? "admin — alles, inclusief edities, facturatie en teamaccounts" : "user — sponsors en overeenkomsten bekijken en bijwerken"}

Als u nog aangemeld was, meldt u zich best even af en opnieuw aan.

Grensrock`
    : `Hi ${userName(user)},

${openedEn}

Link: ${link}
Sign in with your Grensrock account (${user.email}) using "Sign in with Google".
Your role: ${user.role === "admin" ? "admin — everything, including editions, invoicing and team accounts" : "user — view and update sponsors and agreements"}

If you were still signed in, sign out and back in once.

Grensrock`;

  return { subject, body };
}

/* ---------- new agreement, for the admins ----------
   Sent to each admin when an agreement is created — by a team member in
   the app, or by a sponsor picking a formula in the portal — so a new one
   doesn't have to be spotted in the list. Team-facing, so NL/EN in the
   admin's own language, like buildAccessGranted above. */
export function buildAgreementCreated(
  admin: User,
  deal: Pick<Deal, "formulaName" | "cost" | "settlement">,
  sponsorName: string,
  editionName: string,
  createdBy: { name: string; viaPortal: boolean },
  appUrl: string,
) {
  const lang = admin.language === "en" ? "en" : "nl";
  const nl = lang === "nl";
  const custom = !deal.formulaName.trim() || deal.formulaName === OP_MAAT;
  const formula = custom ? (nl ? "op maat" : "custom") : deal.formulaName;
  const by = createdBy.viaPortal
    ? nl
      ? `${createdBy.name || "de sponsor"}, via het sponsorportaal`
      : `${createdBy.name || "the sponsor"}, via the sponsor portal`
    : createdBy.name || (nl ? "een teamlid" : "a team member");

  const subject = nl
    ? `Nieuwe overeenkomst: ${sponsorName} (${editionName})`
    : `New agreement: ${sponsorName} (${editionName})`;

  const body = nl
    ? `Dag ${userName(admin)},

Er is een nieuwe overeenkomst aangemaakt.

Sponsor: ${sponsorName}
Editie: ${editionName}
Formule: ${formula}
Bijdrage: ${eur(deal.cost)}
Afrekening: ${label(SETTLEMENTS, deal.settlement, lang)}
Aangemaakt door: ${by}

Link: ${appUrl}

Grensrock`
    : `Hi ${userName(admin)},

A new agreement has been created.

Sponsor: ${sponsorName}
Edition: ${editionName}
Formula: ${formula}
Contribution: ${eur(deal.cost)}
Settlement: ${label(SETTLEMENTS, deal.settlement, lang)}
Created by: ${by}

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

U hebt toegang tot het Grensrock-sponsorportaal. Daar kan u uw bedrijfsgegevens nakijken, uw logo opladen en uw tickets en bonnen verdelen.

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
