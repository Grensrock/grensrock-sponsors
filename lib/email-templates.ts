import { LED_ZONES } from "@/lib/constants";
import { contactName, primaryContact } from "@/lib/contacts";
import { eur, invoiceAmount, refRequiredFor } from "@/lib/money";
import { normFolder, normLed } from "@/lib/normalize";
import { userName } from "@/lib/users";
import { drinkPoolValue, voucherText } from "@/lib/vouchers";
import type { Contact, Deal, Edition, Language, Sponsor, User } from "@/types";

/* ---------- portal invitation text ---------- */
export function buildInvitation(sponsor: Sponsor, contact?: Contact | null, responsible?: string) {
  const c = contact || primaryContact(sponsor) || ({} as Partial<Contact>);
  const lang: Language = c.language || "nl";
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];
  return B(
    `Beste ${contactName(c) || sponsor.companyName},

Via onze sponsortool kan u de gegevens van ${sponsor.companyName} voor Grensrock zelf nakijken en aanpassen, en uw logo opladen (voor de folder, ledboarding, website, ...).

Link: [link naar de sponsortool]
Meld u aan met uw e-mailadres (${c.email || "het adres dat wij van u hebben"}): u krijgt een aanmeldlink per e-mail, een wachtwoord is niet nodig.

Alvast bedankt!
${responsible || "Het Grensrock-team"}`,
    `Cher/Chère ${contactName(c) || sponsor.companyName},

Via notre outil sponsors, vous pouvez vérifier et modifier vous-même les données de ${sponsor.companyName} pour Grensrock, et télécharger votre logo (pour le dépliant, le ledboarding, le site web, ...).

Lien : [lien vers l'outil sponsors]
Connectez-vous avec votre adresse e-mail (${c.email || "l'adresse que nous avons"}) : vous recevrez un lien de connexion par e-mail, aucun mot de passe n'est nécessaire.

Merci d'avance !
${responsible || "L'équipe Grensrock"}`,
    `Dear ${contactName(c) || sponsor.companyName},

Through our sponsor tool you can review and update ${sponsor.companyName}'s details for Grensrock yourself, and upload your logo (for the folder, LED boarding, website, ...).

Link: [link to the sponsor tool]
Log in with your email address (${c.email || "the address we have on file"}): you'll get a login link by email, no password needed.

Thank you!
${responsible || "The Grensrock team"}`,
  );
}

/* ---------- Email / contract templates ---------- */

export function buildEmail(
  deal: Deal,
  sponsor: Sponsor,
  edition: Edition,
  contact?: Contact | null,
): { subject: string; body: string } {
  const c = contact || primaryContact(sponsor) || ({} as Partial<Contact>);
  const lang: Language = c.language || "nl";
  const benefits: string[] = [];
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];

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
  if (Number(deal.barrierCovers) > 0)
    benefits.push(
      B(
        `${deal.barrierCovers} hoes(sen) voor nadarhekken`,
        `${deal.barrierCovers} housse(s) pour barrières Nadar`,
        `${deal.barrierCovers} crowd control barrier cover(s)`,
      ),
    );
  if (Number(deal.herasCovers) > 0)
    benefits.push(
      B(
        `${deal.herasCovers} hoes(sen) voor Heras-hekken`,
        `${deal.herasCovers} housse(s) pour clôtures Heras`,
        `${deal.herasCovers} Heras fence cover(s)`,
      ),
    );
  const zones = normLed(deal.ledboarding);
  if (zones.length > 0) {
    const zoneList = zones.map((z) => LED_ZONES[z]).join(" + ");
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

  const confirm = B(
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
    `Beste ${contactName(c) || sponsor.companyName},

Hartelijk dank voor uw steun aan ${edition.name}${dates}. Hieronder vindt u een overzicht van de afgesproken sponsorformule${deal.formulaName ? ` "${deal.formulaName}"` : ""}.

Sponsor: ${sponsor.companyName}
BTW-nummer: ${sponsor.vatNumber || "—"}
${contribution}

Inbegrepen:
${list || "  • (geen voordelen geselecteerd)"}
${notes ? "\nOpmerkingen:\n" + notes + "\n" : ""}
${settlementBlock}

${confirm}

Met vriendelijke groeten,
${deal.responsible || "Het Grensrock-team"}
Grensrock`,
    `Cher/Chère ${contactName(c) || sponsor.companyName},

Merci beaucoup pour votre soutien à ${edition.name}${dates}. Vous trouverez ci-dessous un aperçu de la formule de sponsoring convenue${deal.formulaName ? ` « ${deal.formulaName} »` : ""}.

Sponsor : ${sponsor.companyName}
Numéro de TVA : ${sponsor.vatNumber || "—"}
${contribution}

Inclus :
${list || "  • (aucun avantage sélectionné)"}
${notes ? "\nRemarques :\n" + notes + "\n" : ""}
${settlementBlock}

${confirm}

Cordialement,
${deal.responsible || "L'équipe Grensrock"}
Grensrock`,
    `Dear ${contactName(c) || sponsor.companyName},

Thank you very much for supporting ${edition.name}${dates}. Below you will find an overview of the agreed sponsorship formula${deal.formulaName ? ` "${deal.formulaName}"` : ""}.

Sponsor: ${sponsor.companyName}
VAT number: ${sponsor.vatNumber || "—"}
${contribution}

Included:
${list || "  • (no benefits selected)"}
${notes ? "\nNotes:\n" + notes + "\n" : ""}
${settlementBlock}

${confirm}

Kind regards,
${deal.responsible || "The Grensrock team"}
Grensrock`,
  );

  return { subject, body };
}

export function buildUserInvite(user: User) {
  return `Hi ${userName(user)},

You have access to the Grensrock sponsor tool.

Link: [link to the tool]
Log in with your email address (${user.email}) and the password you set through the invitation email from Grensrock.
Your role: ${user.role === "admin" ? "admin (full access)" : "user (sponsors & agreements)"}

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

  return { subject, body };
}
