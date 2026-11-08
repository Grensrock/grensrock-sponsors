import type { Language, TeamLanguage } from "@/types";

/* ============================================================
   Frequently asked questions
   ============================================================
   Two sets: one for sponsors in the portal (NL / FR / EN) and one for the
   team app (NL / EN), where some entries are only for admins.

   Answers use a tiny markup, rendered by components/views/Faq.tsx:
     - a blank line starts a new paragraph
     - a block of lines starting with "- " is a bullet list,
       a block starting with "1. ", "2. "… a numbered list
     - **text** is a button or screen name, shown in bold

   Keep the button names in step with the screens they point at: an FAQ that
   names a button which no longer exists is worse than no FAQ.
   ============================================================ */

export interface FaqEntry {
  q: string;
  a: string;
}

export interface FaqSection {
  title: string;
  entries: FaqEntry[];
}

type L3 = Record<Language, string>;
type L2 = Record<TeamLanguage, string>;

interface SponsorSection {
  title: L3;
  entries: Array<{ q: L3; a: L3 }>;
}

interface TeamSection {
  title: L2;
  adminOnly?: boolean;
  entries: Array<{ q: L2; a: L2; adminOnly?: boolean }>;
}

/* ---------- Sponsor portal ---------- */

const SPONSOR_FAQ: SponsorSection[] = [
  {
    title: { nl: "Aanmelden", fr: "Connexion", en: "Signing in" },
    entries: [
      {
        q: {
          nl: "Hoe meld ik me de volgende keer aan?",
          fr: "Comment me connecter la prochaine fois ?",
          en: "How do I sign in next time?",
        },
        a: {
          nl: "Ga naar de aanmeldpagina, kies **Aanmelden als sponsor** en meld u aan met uw e-mailadres en wachtwoord.\n\nLiever geen wachtwoord? Kies **Liever zonder wachtwoord? Stuur me een aanmeldlink**. U krijgt dan een link per mail die één uur geldig is en één keer werkt.",
          fr: "Rendez-vous sur la page de connexion, choisissez **Se connecter en tant que sponsor** et connectez-vous avec votre adresse e-mail et votre mot de passe.\n\nVous préférez ne pas utiliser de mot de passe ? Choisissez **Plutôt sans mot de passe ? Envoyez-moi un lien de connexion**. Vous recevez alors par e-mail un lien valable une heure, utilisable une seule fois.",
          en: "Go to the sign-in page, choose **Log in as sponsor** and sign in with your email address and password.\n\nRather not use a password? Choose **Rather not use a password? Send me a sign-in link**. You'll get a link by email that is valid for one hour and works once.",
        },
      },
      {
        q: {
          nl: "Ik heb nog geen wachtwoord, of ik ben het vergeten.",
          fr: "Je n'ai pas encore de mot de passe, ou je l'ai oublié.",
          en: "I don't have a password yet, or I forgot it.",
        },
        a: {
          nl: "Kies op de aanmeldpagina **Wachtwoord vergeten of nog geen wachtwoord?** en vul uw e-mailadres in. U krijgt een mail om een (nieuw) wachtwoord te kiezen. Een wachtwoord heeft minstens 10 tekens.",
          fr: "Sur la page de connexion, choisissez **Mot de passe oublié, ou pas encore de mot de passe ?** et indiquez votre adresse e-mail. Vous recevez un e-mail pour choisir un (nouveau) mot de passe. Un mot de passe compte au moins 10 caractères.",
          en: "On the sign-in page, choose **Forgot your password, or don't have one yet?** and enter your email address. You'll get an email to choose a (new) password. A password needs at least 10 characters.",
        },
      },
      {
        q: {
          nl: "De link in mijn mail werkt niet meer.",
          fr: "Le lien dans mon e-mail ne fonctionne plus.",
          en: "The link in my email no longer works.",
        },
        a: {
          nl: "Links zijn maar een tijd geldig:\n\n- de persoonlijke link in de bevestigingsmail van uw overeenkomst: 14 dagen\n- de link om een wachtwoord te kiezen: 14 dagen, één keer\n- een aanmeldlink zonder wachtwoord: één uur, één keer\n\nVraag op de aanmeldpagina een nieuwe link aan. Een nieuwe link maakt de vorige ongeldig, gebruik dus altijd de meest recente mail.",
          fr: "Les liens ne sont valables qu'un certain temps :\n\n- le lien personnel dans l'e-mail de confirmation de votre accord : 14 jours\n- le lien pour choisir un mot de passe : 14 jours, une seule fois\n- un lien de connexion sans mot de passe : une heure, une seule fois\n\nDemandez un nouveau lien sur la page de connexion. Un nouveau lien annule le précédent : utilisez toujours l'e-mail le plus récent.",
          en: "Links are only valid for a while:\n\n- the personal link in the confirmation email for your agreement: 14 days\n- the link to choose a password: 14 days, once\n- a sign-in link without a password: one hour, once\n\nRequest a new link on the sign-in page. A new link makes the previous one invalid, so always use the most recent email.",
        },
      },
      {
        q: {
          nl: "Ik kan me niet aanmelden met mijn e-mailadres.",
          fr: "Je n'arrive pas à me connecter avec mon adresse e-mail.",
          en: "I can't sign in with my email address.",
        },
        a: {
          nl: "U kan enkel aanmelden als u als contactpersoon van uw bedrijf toegang tot het portaal hebt. Vraag een collega die al toegang heeft om u uit te nodigen (zie **Contactpersonen**), of neem contact op met uw contactpersoon bij Grensrock.",
          fr: "Vous ne pouvez vous connecter que si vous avez accès au portail en tant que contact de votre entreprise. Demandez à un collègue qui a déjà accès de vous inviter (voir **Contacts**), ou contactez votre interlocuteur chez Grensrock.",
          en: "You can only sign in if you have portal access as a contact person of your company. Ask a colleague who already has access to invite you (see **Contact persons**), or get in touch with your contact at Grensrock.",
        },
      },
    ],
  },
  {
    title: { nl: "Uw gegevens", fr: "Vos données", en: "Your details" },
    entries: [
      {
        q: {
          nl: "Hoe pas ik onze bedrijfsgegevens aan?",
          fr: "Comment modifier les données de notre entreprise ?",
          en: "How do I update our company details?",
        },
        a: {
          nl: "Open het tabblad **Gegevens**, pas aan wat nodig is en klik **Gegevens opslaan**. Dit tabblad bewaart niet vanzelf: wie afsluit zonder op te slaan, verliest de wijzigingen.\n\nBij een geldig Belgisch BTW-nummer vullen we naam en adres aan uit de Kruispuntbank van Ondernemingen. Kijk ze na voor u opslaat.",
          fr: "Ouvrez l'onglet **Données**, modifiez ce qui doit l'être et cliquez sur **Enregistrer**. Cet onglet n'enregistre pas automatiquement : si vous quittez sans enregistrer, vos modifications sont perdues.\n\nAvec un numéro de TVA belge valide, nous complétons le nom et l'adresse à partir de la Banque-Carrefour des Entreprises. Vérifiez-les avant d'enregistrer.",
          en: "Open the **Information** tab, change what's needed and click **Save details**. This tab doesn't save by itself: if you leave without saving, your changes are lost.\n\nWith a valid Belgian VAT number we fill in the name and address from the Belgian company registry. Check them before you save.",
        },
      },
      {
        q: {
          nl: "Wie ontvangt de tickets en vouchers?",
          fr: "Qui reçoit les tickets et les bons ?",
          en: "Who receives the tickets and vouchers?",
        },
        a: {
          nl: "Dat kiest u in het tabblad **Gegevens**. Laat u het op automatisch staan, dan gaan ze naar de eerste contactpersoon. Vergeet niet op **Gegevens opslaan** te klikken.",
          fr: "Vous le choisissez dans l'onglet **Données**. Si vous laissez « automatique », ils sont envoyés au premier contact. N'oubliez pas de cliquer sur **Enregistrer**.",
          en: "You choose this in the **Information** tab. If you leave it on automatic, they go to the first contact person. Don't forget to click **Save details**.",
        },
      },
      {
        q: {
          nl: "We hebben een bestelbon- of PO-nummer nodig op de factuur.",
          fr: "Nous avons besoin d'un bon de commande ou d'un numéro PO sur la facture.",
          en: "We need a purchase order or PO number on the invoice.",
        },
        a: {
          nl: "Vink in het tabblad **Gegevens** het vakje voor de referentie aan en sla op. Bezorg ons daarna de referentie zelf, bijvoorbeeld als antwoord op de bevestigingsmail. We maken de factuur pas op als we die referentie hebben.",
          fr: "Dans l'onglet **Données**, cochez la case de la référence et enregistrez. Communiquez-nous ensuite la référence elle-même, par exemple en répondant à l'e-mail de confirmation. Nous n'établissons la facture qu'une fois cette référence reçue.",
          en: "In the **Information** tab, tick the box for the reference and save. Then send us the reference itself, for example by replying to the confirmation email. We only issue the invoice once we have it.",
        },
      },
    ],
  },
  {
    title: { nl: "Contactpersonen", fr: "Contacts", en: "Contact persons" },
    entries: [
      {
        q: {
          nl: "Hoe voeg ik een collega toe?",
          fr: "Comment ajouter un collègue ?",
          en: "How do I add a colleague?",
        },
        a: {
          nl: "1. Open het tabblad **Contactpersonen** en klik **+ Contactpersoon toevoegen**.\n2. Vul naam, e-mail, telefoon en taal in en kies wat die persoon van ons ontvangt.\n3. Moet die persoon ook in het portaal kunnen? Klik dan **Uitnodigen** naast de naam. Er vertrekt meteen een mail om een wachtwoord te kiezen.\n\nContactpersonen worden meteen bewaard, u hoeft hier niet op opslaan te klikken.",
          fr: "1. Ouvrez l'onglet **Contacts** et cliquez sur **+ Ajouter un contact**.\n2. Indiquez le nom, l'e-mail, le téléphone et la langue, et choisissez ce que cette personne reçoit de notre part.\n3. Cette personne doit-elle aussi accéder au portail ? Cliquez alors sur **Inviter** à côté de son nom. Un e-mail part aussitôt pour choisir un mot de passe.\n\nLes contacts sont enregistrés immédiatement, inutile de cliquer sur enregistrer.",
          en: "1. Open the **Contact persons** tab and click **+ Add contact**.\n2. Fill in name, email, phone and language, and choose what this person receives from us.\n3. Should they be able to use the portal too? Click **Invite** next to their name. An email to choose a password goes out straight away.\n\nContact persons are saved straight away; there's no save button to click here.",
        },
      },
      {
        q: {
          nl: "Hoe verander ik de taal van het portaal en van de mails?",
          fr: "Comment changer la langue du portail et des e-mails ?",
          en: "How do I change the language of the portal and the emails?",
        },
        a: {
          nl: "Het portaal en onze mails volgen de taal van uw contactpersoon. Klik in **Contactpersonen** op uw naam, kies een andere taal en bewaar. Nederlands, Frans en Engels zijn mogelijk.",
          fr: "Le portail et nos e-mails suivent la langue de votre fiche de contact. Dans **Contacts**, cliquez sur votre nom, choisissez une autre langue et enregistrez. Le néerlandais, le français et l'anglais sont disponibles.",
          en: "The portal and our emails follow the language on your contact details. In **Contact persons**, click your name, pick another language and save. Dutch, French and English are available.",
        },
      },
      {
        q: {
          nl: "Hoe zet ik een contactpersoon in mijn telefoon?",
          fr: "Comment ajouter un contact à mon téléphone ?",
          en: "How do I add a contact person to my phone?",
        },
        a: {
          nl: "Klik in **Contactpersonen** op de naam en kies bovenaan **Toevoegen aan mijn contacten**. Op een iPhone opent meteen een nieuw contact met naam, bedrijf, e-mail en telefoon, dat u enkel nog bewaart. Op Android of een computer wordt een contactkaart (.vcf) gedownload: open die om ze aan uw contacten toe te voegen.",
          fr: "Dans **Contacts**, cliquez sur le nom et choisissez en haut **Ajouter à mes contacts**. Sur un iPhone, un nouveau contact s'ouvre aussitôt avec le nom, l'entreprise, l'e-mail et le téléphone : il ne vous reste qu'à l'enregistrer. Sur Android ou sur un ordinateur, une fiche de contact (.vcf) est téléchargée : ouvrez-la pour l'ajouter à vos contacts.",
          en: "In **Contact persons**, click the name and choose **Add to my contacts** at the top. On an iPhone a new contact opens straight away with the name, company, email and phone, ready to save. On Android or a computer a contact card (.vcf) is downloaded: open it to add it to your contacts.",
        },
      },
    ],
  },
  {
    title: { nl: "Logo's", fr: "Logos", en: "Logos" },
    entries: [
      {
        q: {
          nl: "Welk logobestand moet ik opladen?",
          fr: "Quel fichier de logo dois-je télécharger ?",
          en: "Which logo file should I upload?",
        },
        a: {
          nl: "Bij voorkeur een vectorbestand: .ai, .eps, .pdf of .svg. Dat blijft scherp op elk formaat, van folder tot ledboarding. Een PNG, JPG of WebP kan ook, vanaf 400×400 pixels. Een bestand mag maximaal 10 MB zijn.",
          fr: "De préférence un fichier vectoriel : .ai, .eps, .pdf ou .svg. Il reste net à toutes les tailles, du dépliant à l'écran LED. Un PNG, JPG ou WebP convient aussi, à partir de 400×400 pixels. Un fichier ne peut pas dépasser 10 Mo.",
          en: "A vector file if you can: .ai, .eps, .pdf or .svg. It stays sharp at any size, from the folder to the LED boarding. A PNG, JPG or WebP works too, from 400×400 pixels. A file can be at most 10 MB.",
        },
      },
      {
        q: {
          nl: "Waarvoor wordt welk logo gebruikt?",
          fr: "Quel logo est utilisé pour quoi ?",
          en: "Which logo is used for what?",
        },
        a: {
          nl: "U kan meerdere logo's opladen. Vink bij elk logo aan of het voor de **Folder** en/of de **Ledboarding** mag dienen. Vaak is een logo voor print niet hetzelfde als een logo voor een scherm.",
          fr: "Vous pouvez télécharger plusieurs logos. Pour chacun, cochez s'il peut servir pour le **Dépliant** et/ou le **Ledboarding**. Un logo pour l'impression est souvent différent d'un logo pour un écran.",
          en: "You can upload several logos. For each one, tick whether it may be used for the **Folder** and/or the **LED boarding**. A logo for print is often not the same as one for a screen.",
        },
      },
    ],
  },
  {
    title: { nl: "Uw overeenkomst", fr: "Votre accord", en: "Your agreement" },
    entries: [
      {
        q: {
          nl: "Hoe kies ik een formule?",
          fr: "Comment choisir une formule ?",
          en: "How do I choose a formula?",
        },
        a: {
          nl: "In het tabblad **Sponsoring** ziet u de formules voor de editie(s) waarvoor u nog geen overeenkomst hebt. Klik **Deze formule kiezen** en daarna **Bevestig mijn keuze**. Wij kijken uw keuze na en sturen u daarna de overeenkomst per mail.",
          fr: "Dans l'onglet **Sponsoring**, vous voyez les formules des éditions pour lesquelles vous n'avez pas encore d'accord. Cliquez sur **Choisir cette formule**, puis sur **Confirmer mon choix**. Nous vérifions votre choix et vous envoyons ensuite l'accord par e-mail.",
          en: "In the **Sponsorship** tab you'll see the formulas for the edition(s) you don't have an agreement for yet. Click **Choose this formula** and then **Confirm my choice**. We review your choice and then send you the agreement by email.",
        },
      },
      {
        q: {
          nl: "Hoe aanvaard ik de overeenkomst?",
          fr: "Comment accepter l'accord ?",
          en: "How do I accept the agreement?",
        },
        a: {
          nl: "1. Klik op de melding bovenaan op **Nakijken en bevestigen**, of open het tabblad **Sponsoring**.\n2. Lees de afspraken: formule, bijdrage, tickets en vouchers, zichtbaarheid en opmerkingen.\n3. Vink aan dat u de afspraken gelezen hebt en akkoord gaat, en klik **Lezen en aanvaarden**.\n\nWe bewaren het moment, uw naam en een kopie van de afspraken zoals u ze aanvaardde. Klopt er iets niet? Aanvaard dan nog niet en neem contact met ons op.",
          fr: "1. Cliquez sur **Consulter et confirmer** dans le bandeau en haut, ou ouvrez l'onglet **Sponsoring**.\n2. Lisez les conditions : formule, contribution, tickets et bons, visibilité et remarques.\n3. Cochez que vous avez lu les conditions et que vous les acceptez, puis cliquez sur **Lire et accepter**.\n\nNous conservons le moment, votre nom et une copie des conditions telles que vous les avez acceptées. Quelque chose ne va pas ? N'acceptez pas encore et contactez-nous.",
          en: "1. Click **Review and confirm** in the banner at the top, or open the **Sponsorship** tab.\n2. Read the terms: formula, contribution, tickets and vouchers, visibility and notes.\n3. Tick that you have read and agree to the terms, and click **Read and accept**.\n\nWe keep the moment, your name and a copy of the terms as you accepted them. Something not right? Don't accept yet and get in touch with us.",
        },
      },
      {
        q: {
          nl: "Ik moet een overeenkomst opnieuw aanvaarden.",
          fr: "Je dois accepter un accord une nouvelle fois.",
          en: "I have to accept an agreement again.",
        },
        a: {
          nl: "Als we een overeenkomst aanpassen nadat u ze aanvaardde, vragen we u om de nieuwe versie opnieuw te aanvaarden. U krijgt daarvoor een nieuwe mail en de overeenkomst staat weer bij **nog te bevestigen**.",
          fr: "Si nous modifions un accord après que vous l'avez accepté, nous vous demandons d'accepter la nouvelle version. Vous recevez un nouvel e-mail et l'accord apparaît à nouveau comme **à confirmer**.",
          en: "If we change an agreement after you accepted it, we'll ask you to accept the new version. You'll get a new email and the agreement shows as **to confirm** again.",
        },
      },
      {
        q: {
          nl: "Kan ik extra eten- en drankvouchers bijnemen?",
          fr: "Puis-je ajouter des bons food & boissons ?",
          en: "Can I add extra food and drink tickets?",
        },
        a: {
          nl: "Ja, zolang die vouchers nog niet aangemaakt zijn. Vul in het tabblad **Sponsoring** de totale waarde in die u wenst en klik **Bijwerken**. Ze komen bovenop uw formule: wat u bijneemt, komt bij uw bijdrage.",
          fr: "Oui, tant que ces bons n'ont pas encore été créés. Dans l'onglet **Sponsoring**, indiquez la valeur totale souhaitée et cliquez sur **Mettre à jour**. Ils s'ajoutent à votre formule : ce que vous ajoutez s'ajoute à votre contribution.",
          en: "Yes, as long as those tickets haven't been created yet. In the **Sponsorship** tab, enter the total value you'd like and click **Update**. They come on top of your formula: what you add is added to your contribution.",
        },
      },
    ],
  },
  {
    title: { nl: "Tickets en vouchers", fr: "Tickets et bons", en: "Tickets and vouchers" },
    entries: [
      {
        q: {
          nl: "Hoe verdeel ik mijn vouchers?",
          fr: "Comment répartir mes bons ?",
          en: "How do I divide my vouchers?",
        },
        a: {
          nl: "In het tabblad **Sponsoring** klikt u onder **Uw vouchers** op **Vouchers verdelen**. Daar kiest u zelf in hoeveel vouchers uw bedrag wordt opgesplitst, bijvoorbeeld één grote voucher of meerdere kleinere. Drankvouchers en vouchers voor eten & drinken blijven apart. Uw verdeling wordt bewaard zodra u het veld verlaat.\n\nZodra wij de vouchers aangemaakt hebben, ligt de verdeling vast. Moet er dan nog iets veranderen, neem dan contact met ons op.",
          fr: "Dans l'onglet **Sponsoring**, cliquez sur **Répartir les bons** sous **Vos bons**. Vous y choisissez vous-même en combien de bons votre montant est réparti, par exemple un seul gros bon ou plusieurs plus petits. Les bons boissons et les bons food & boissons restent séparés. Votre répartition est enregistrée dès que vous quittez le champ.\n\nUne fois les bons créés par nos soins, la répartition est définitive. Si quelque chose doit encore changer, contactez-nous.",
          en: "In the **Sponsorship** tab, click **Divide vouchers** under **Your vouchers**. There you choose how many vouchers your amount is split into, for example one large voucher or several smaller ones. Drink vouchers and food & drink vouchers stay separate. Your split is saved as soon as you leave the field.\n\nOnce we've created the vouchers, the split is fixed. If something still needs to change, get in touch with us.",
        },
      },
      {
        q: {
          nl: "Wanneer krijg ik mijn tickets en vouchers?",
          fr: "Quand vais-je recevoir mes tickets et bons ?",
          en: "When do I get my tickets and vouchers?",
        },
        a: {
          nl: "Zodra we ze aangemaakt en verstuurd hebben, staan ze in het tabblad **Tickets & vouchers**. Met **Bekijk** opent u een ticket of voucher. Ze gaan ook naar de persoon die u bij **Gegevens** als ontvanger koos.",
          fr: "Dès que nous les avons créés et envoyés, ils apparaissent dans l'onglet **Tickets & bons**. Cliquez sur **Voir** pour ouvrir un ticket ou un bon. Ils sont aussi envoyés à la personne choisie comme destinataire dans **Données**.",
          en: "As soon as we've created and sent them, they appear in the **Tickets & vouchers** tab. Click **View** to open a ticket or voucher. They also go to the person you chose as recipient under **Information**.",
        },
      },
      {
        q: {
          nl: "Kan ik een ticket aan iemand anders geven?",
          fr: "Puis-je donner un ticket à quelqu'un d'autre ?",
          en: "Can I give a ticket to someone else?",
        },
        a: {
          nl: "Ja. Klik in **Tickets & vouchers** op **Doorgeven** naast het ticket en vul naam en e-mail in. Wij sturen het ticket op naam naar dat adres. Met **Wijzig** past u het later nog aan, met **Terugnemen** maakt u het ongedaan.",
          fr: "Oui. Dans **Tickets & bons**, cliquez sur **Transmettre** à côté du ticket et indiquez le nom et l'e-mail. Nous envoyons le ticket nominatif à cette adresse. Avec **Modifier** vous pouvez encore le changer plus tard, avec **Reprendre** vous l'annulez.",
          en: "Yes. In **Tickets & vouchers**, click **Pass on** next to the ticket and enter a name and email. We'll send the personalised ticket to that address. Use **Change** to adjust it later, or **Take back** to undo it.",
        },
      },
    ],
  },
  {
    title: { nl: "Hulp nodig?", fr: "Besoin d'aide ?", en: "Need help?" },
    entries: [
      {
        q: {
          nl: "Er verschijnt een melding dat iets niet bewaard kon worden.",
          fr: "Un message indique que quelque chose n'a pas pu être enregistré.",
          en: "A message says something couldn't be saved.",
        },
        a: {
          nl: "Controleer uw internetverbinding en probeer het opnieuw. Lukt het daarna nog altijd niet, herlaad dan de pagina en doe de wijziging opnieuw.",
          fr: "Vérifiez votre connexion internet et réessayez. Si cela ne fonctionne toujours pas, rechargez la page et refaites la modification.",
          en: "Check your internet connection and try again. If it still doesn't work, reload the page and make the change again.",
        },
      },
      {
        q: {
          nl: "Mijn vraag staat er niet bij.",
          fr: "Ma question n'est pas dans la liste.",
          en: "My question isn't listed here.",
        },
        a: {
          nl: "Neem contact op met uw contactpersoon bij Grensrock, of antwoord op de laatste mail die u van ons kreeg. We helpen u graag verder.",
          fr: "Contactez votre interlocuteur chez Grensrock, ou répondez au dernier e-mail que vous avez reçu de notre part. Nous vous aiderons volontiers.",
          en: "Get in touch with your contact at Grensrock, or reply to the last email you received from us. We're happy to help.",
        },
      },
    ],
  },
];

/* ---------- Team app ---------- */

const TEAM_FAQ: TeamSection[] = [
  {
    title: { nl: "Aanmelden en account", en: "Signing in and your account" },
    entries: [
      {
        q: {
          nl: "Ik zie na het aanmelden alleen \"Nog even wachten\".",
          en: "After signing in I only see \"Nog even wachten\" (just a moment).",
        },
        a: {
          nl: "Een beheerder moet je toegang nog goedkeuren in **Beheer → Team**. Beheerders krijgen daar geen melding van, laat het dus zelf weten. Meld je na de goedkeuring af en opnieuw aan met **Aanmelden met Google**.",
          en: "An admin still has to grant your access in **Admin → Team**. Admins aren't notified, so let them know yourself. Once you're approved, sign out and sign in again with **Sign in with Google**.",
        },
      },
      {
        q: {
          nl: "Ik kom in een leeg scherm en niets wordt opgeslagen.",
          en: "I land on an empty screen and nothing gets saved.",
        },
        a: {
          nl: "Je bent aangemeld met een Google-account buiten @grensrock.be. Meld je af en kies je @grensrock.be-account.",
          en: "You're signed in with a Google account outside @grensrock.be. Sign out and pick your @grensrock.be account.",
        },
      },
      {
        q: {
          nl: "Hoe verander ik de taal van de tool?",
          en: "How do I change the language of the app?",
        },
        a: {
          nl: "Met de keuzelijst **NL/EN** rechtsboven. Die geldt enkel voor deze sessie. Je vaste taal stelt een beheerder in bij **Beheer → Team**.",
          en: "With the **NL/EN** list at the top right. That only lasts for this session. An admin sets your default language in **Admin → Team**.",
        },
      },
      {
        q: {
          nl: "Ik zie de tabbladen Vouchers, Folder, Facturatie of Beheer niet.",
          en: "I don't see the Vouchers, Folder, Invoicing or Admin tabs.",
        },
        a: {
          nl: "Die zijn enkel voor beheerders. Heb je ze nodig, vraag dan een beheerder om je rol aan te passen.",
          en: "Those are for admins only. If you need them, ask an admin to change your role.",
        },
      },
      {
        q: {
          nl: "Bovenaan staat \"Kon de laatste wijziging niet opslaan\".",
          en: "The top of the screen says \"Couldn't save the last change\".",
        },
        a: {
          nl: "Controleer je internetverbinding, herlaad de pagina en doe de laatste wijziging opnieuw.",
          en: "Check your internet connection, reload the page and make the last change again.",
        },
      },
      {
        q: {
          nl: "Ik kreeg een mail dat ik toegang heb. Hoe meld ik me aan?",
          en: "I got an email saying I have access. How do I sign in?",
        },
        a: {
          nl: "Klik **Open de sponsortool** in de mail en kies **Aanmelden met Google**, met het Google-account dat in de mail staat. Een apart wachtwoord voor de tool is er niet.\n\nGebruik precies dat account: met een ander account kom je bij \"Nog even wachten\" of in een leeg scherm.",
          en: "Click **Open the sponsor tool** in the email and choose **Sign in with Google**, with the Google account the email names. There is no separate password for the app.\n\nUse exactly that account: with another one you end up on \"Nog even wachten\" or on an empty screen.",
        },
      },
    ],
  },
  {
    title: { nl: "Sponsors en contactpersonen", en: "Sponsors and contact persons" },
    entries: [
      {
        q: {
          nl: "Welke sponsors mag ik wijzigen?",
          en: "Which sponsors can I change?",
        },
        a: {
          nl: "Als gebruiker wijzig je enkel de sponsors waarvoor jij de verantwoordelijke bent: hun gegevens, contactpersonen, afzeggingen en overeenkomsten. Voor die sponsors verstuur je ook de bevestigingsmail. Alle andere sponsors en overeenkomsten kan je bekijken, maar niet wijzigen. Logo's kan iedereen van het team toevoegen.\n\nEnkel een beheerder kan:\n- elke sponsor wijzigen, ook een sponsor zonder verantwoordelijke\n- lijsten met sponsors, contactpersonen of overeenkomsten importeren\n- sponsors en overeenkomsten verwijderen\n\nKies **Mijn sponsors tonen** in de lijst om enkel je eigen sponsors te zien.",
          en: "As a user you only change the sponsors you are the responsible person for: their details, contact persons, declines and agreements. For those sponsors you also send the confirmation email. You can view every other sponsor and agreement, but not change them. Anyone on the team can add logos.\n\nOnly an admin can:\n- change any sponsor, including one without a responsible person\n- import lists of sponsors, contact persons or agreements\n- delete sponsors and agreements\n\nChoose **Show my sponsors** in the list to see only your own sponsors.",
        },
      },
      {
        q: {
          nl: "Ik zie geen knop om een sponsor te wijzigen.",
          en: "I don't see a button to change a sponsor.",
        },
        a: {
          nl: "Je bent niet de verantwoordelijke voor die sponsor. Bovenaan de sponsorpagina staat wie dat wel is. Vraag die persoon of een beheerder om de wijziging te doen, of vraag een beheerder om de sponsor aan jou toe te wijzen. Heeft de sponsor nog geen verantwoordelijke, dan wijst een beheerder hem eerst toe.",
          en: "You're not the responsible person for that sponsor. The top of the sponsor page says who is. Ask that person or an admin to make the change, or ask an admin to assign the sponsor to you. If the sponsor has no responsible person yet, an admin assigns it first.",
        },
      },
      {
        q: { nl: "Hoe voeg ik een sponsor toe?", en: "How do I add a sponsor?" },
        a: {
          nl: "1. Ga naar **Sponsors** en klik **+ Nieuwe sponsor**.\n2. Vul **Bedrijf / naam** en het BTW-nummer in. Bij een geldig Belgisch nummer vult de tool naam en adres aan uit de KBO.\n3. Kies het type. Als verantwoordelijke staat jij al ingevuld; kies iemand anders als een collega de sponsor opvolgt.\n4. Vink de referentie aan als de sponsor een bestelbon, PO-nummer of kostenplaats nodig heeft op contract en factuur.\n5. Klik **Sponsor opslaan** en voeg daarna de contactpersonen toe op de sponsorpagina.\n\nKies je een andere verantwoordelijke, dan kan je de sponsor daarna zelf niet meer wijzigen.",
          en: "1. Go to **Sponsors** and click **+ New sponsor**.\n2. Fill in **Company / name** and the VAT number. With a valid Belgian number the app fills in name and address from the company registry.\n3. Pick the type. You're already filled in as the responsible person; pick someone else if a colleague follows up this sponsor.\n4. Tick the reference box if the sponsor needs a purchase order, PO number or cost centre on the contract and invoice.\n5. Click **Save sponsor**, then add the contact persons on the sponsor page.\n\nIf you pick someone else as responsible, you can't change the sponsor yourself afterwards.",
        },
      },
      {
        q: {
          nl: "De sponsor heeft geen BTW-nummer.",
          en: "The sponsor doesn't have a VAT number.",
        },
        a: {
          nl: "Vink **Heeft geen BTW-nummer** aan onder het BTW-veld, bijvoorbeeld voor een particulier of een vereniging. Zonder geldig BTW-nummer of dat vinkje kan je de sponsor niet opslaan.",
          en: "Tick **Does not have a VAT number** below the VAT field, for example for a private person or an association. Without a valid VAT number or that tick, the sponsor can't be saved.",
        },
      },
      {
        q: {
          nl: "De tool waarschuwt \"Mogelijk dubbel\".",
          en: "The app warns about a possible duplicate.",
        },
        a: {
          nl: "Er bestaat al een sponsor met dezelfde naam of hetzelfde BTW-nummer. Kijk na of het niet dezelfde sponsor is voor je **Toch toevoegen** kiest.",
          en: "A sponsor with the same name or VAT number already exists. Check it isn't the same sponsor before you choose to add it anyway.",
        },
      },
      {
        q: {
          nl: "Hoe geef ik een contactpersoon toegang tot het sponsorportaal?",
          en: "How do I give a contact person access to the sponsor portal?",
        },
        a: {
          nl: "Vink **Toegang tot het sponsorportaal** aan op de contactpersoon. De persoon krijgt meteen een mail om een wachtwoord te kiezen, 14 dagen geldig. In het tabblad **Contactpersonen** geef je meerdere mensen tegelijk toegang met **Portaaltoegang geven**.\n\nEen e-mailadres kan maar bij één sponsor portaaltoegang hebben.",
          en: "Tick **Access to the sponsor portal** on the contact person. They get an email straight away to choose a password, valid for 14 days. In the **Contacts** tab you can give several people access at once.\n\nAn email address can only have portal access for one sponsor.",
        },
      },
      {
        q: {
          nl: "Een sponsor kan zich niet aanmelden.",
          en: "A sponsor can't sign in.",
        },
        a: {
          nl: "Kijk na of de contactpersoon een e-mailadres heeft en of de portaaltoegang actief is. Is een link verlopen, stuur dan een nieuwe met **Nieuwe link sturen** in het tabblad **Contactpersonen**. De vorige link werkt daarna niet meer. De sponsor kan ook zelf een aanmeldlink aanvragen op de aanmeldpagina.",
          en: "Check that the contact person has an email address and that portal access is active. If a link has expired, send a new one from the **Contacts** tab. The previous link stops working. The sponsor can also request a sign-in link on the sign-in page themselves.",
        },
      },
      {
        q: {
          nl: "Hoe zie ik wat een sponsor in het portaal ziet?",
          en: "How do I see what a sponsor sees in the portal?",
        },
        a: {
          nl: "Open de sponsor, ga naar het tabblad **Contactpersonen** en klik **Portaal bekijken**. Dat voorbeeld is alleen-lezen. Je gaat terug met **Terug naar het team**.",
          en: "Open the sponsor, go to the **Contact persons** tab and click the portal preview button. The preview is read-only. You go back with **Back to the team**.",
        },
      },
      {
        q: {
          nl: "Een bedrijf sponsort deze editie niet.",
          en: "A company isn't sponsoring this edition.",
        },
        a: {
          nl: "Klik op de sponsorpagina **Sponsort niet…**, kies de editie, vul eventueel een reden in en klik **Afzegging opslaan**. De sponsor staat dan bij **Haakt af voor** in de lijst. Maak je later toch een overeenkomst voor die editie, dan verdwijnt de afzegging vanzelf.",
          en: "On the sponsor page, click the decline button, choose the edition, add a reason if you like and save. The sponsor then shows up under the declined filter in the list. If you make an agreement for that edition later, the decline disappears by itself.",
        },
      },
      {
        q: {
          nl: "Hoe geef ik een sponsor een formulier om in te vullen?",
          en: "How do I give a sponsor a form to fill in?",
        },
        a: {
          nl: "Voor een sponsor die je persoonlijk ziet, of die liever een formulier terugstuurt dan het portaal gebruikt.\n\n1. Klik **PDF-formulier** op de sponsorpagina, of bovenaan de lijst in **Sponsors** en kies daar de sponsor.\n2. Kies de editie en de **Taal van het formulier**. Die staat al op de taal van de sponsor.\n3. Klik **PDF downloaden**.\n\nHet formulier vul je in op de computer of druk je af. Wat we van de sponsor weten staat er al in: bedrijfsgegevens, adres, referentie voor de factuur en contactpersonen. De sponsor duidt een formule van de editie aan, eventueel eten & drinken erbovenop, en tekent. Heeft de sponsor al een overeenkomst voor die editie, dan staat die aangeduid. Interne gegevens komen er niet op.\n\nVoor meerdere sponsors tegelijk: vink ze aan in de lijst en klik **PDF-formulieren**. Elke sponsor krijgt een eigen PDF, in zijn eigen taal tenzij je één taal voor allemaal kiest, samen in één zip-bestand. Kan één formulier niet gemaakt worden, dan wordt niets gedownload en zie je voor welke sponsor.\n\nIedereen van het team kan dit, ook voor sponsors die je niet mag wijzigen.",
          en: "For a sponsor you meet in person, or one who would rather return a form than use the portal.\n\n1. Click **PDF form** on the sponsor page, or at the top of the list in **Sponsors** and pick the sponsor there.\n2. Pick the edition and the **Language of the form**. It starts as the sponsor's own language.\n3. Click **Download PDF**.\n\nThe form can be filled in on a computer or printed. What we know of the sponsor is already in it: company details, address, invoice reference and contact persons. The sponsor marks one of the edition's formulas, food & drink on top if they like, and signs. If the sponsor already has an agreement for that edition, it comes marked. Nothing internal goes on it.\n\nFor several sponsors at once: tick them in the list and click **PDF forms**. Each sponsor gets a PDF of their own, in their own language unless you pick one language for all, together in one zip file. If one form can't be made, nothing is downloaded and you see which sponsor it was.\n\nAnyone on the team can do this, also for sponsors you can't change.",
        },
      },
      {
        q: {
          nl: "Hoe zet ik een contactpersoon in mijn telefoon?",
          en: "How do I add a contact person to my phone?",
        },
        a: {
          nl: "Klik op de contactpersoon, in het tabblad **Contactpersonen** of op de sponsorpagina, en kies bovenaan **Toevoegen aan mijn contacten**. Op een iPhone opent meteen een nieuw contact met naam, bedrijf, e-mail en telefoon, dat je enkel nog bewaart. Op Android of een computer wordt een contactkaart (.vcf) gedownload: open die om ze aan je contacten toe te voegen.\n\nEen contactpersoon opent enkel bij een sponsor die je mag wijzigen.",
          en: "Click the contact person, in the **Contacts** tab or on the sponsor page, and choose **Add to my contacts** at the top. On an iPhone a new contact opens straight away with the name, company, email and phone, ready to save. On Android or a computer a contact card (.vcf) is downloaded: open it to add it to your contacts.\n\nA contact person only opens for a sponsor you can change.",
        },
      },
    ],
  },
  {
    title: { nl: "Overeenkomsten", en: "Agreements" },
    entries: [
      {
        q: { nl: "Hoe registreer ik een overeenkomst?", en: "How do I register an agreement?" },
        a: {
          nl: "1. Klik **+ Nieuwe overeenkomst**, of **+ Overeenkomst** op de sponsorpagina.\n2. Kies de sponsor, de editie en een formule. Had de sponsor al een overeenkomst in een vorige editie, dan zie je welke formule dat was. **Opnieuw …, zelfde voordelen** kiest die formule opnieuw, aan de prijs van nu, met de voordelen van toen. Wijken die af van de formule van nu, dan moet een admin dat goedkeuren, zoals bij elke aanpassing. De formule vult kostprijs en voordelen in. De kostprijs kan je aanpassen; de voordelen staan als lijst, zoals in de formule, tot je **Voordelen aanpassen** kiest. Een andere formule kiezen overschrijft wat je al aanpaste. Eten & drinken vul je meteen in, onder **Vouchers**; hoe de bedragen in vouchers verdeeld worden, pas je daar aan met **Vouchers verdelen**.\n3. Kies hoe de bijdrage wordt afgehandeld: factuur, in natura of een combinatie.\n4. Vul indien nodig de referentie voor de factuur en notities in. Notities komen in de mail aan de sponsor en horen bij wat die aanvaardt.\n5. Klik **Overeenkomst opslaan**. Het venster voor de bevestigingsmail opent meteen.",
          en: "1. Click **+ New agreement**, or the agreement button on the sponsor page.\n2. Pick the sponsor, the edition and a formula. If the sponsor had an agreement in an earlier edition, you see which formula it was. **… again, same benefits** picks that formula again, at today's price, with the benefits from then. If those differ from the formula as it is now, an admin has to approve that, as with any change. The formula fills in the cost and benefits. You can change the cost; the benefits are listed as in the formula until you choose **Change the benefits**. Picking another formula overwrites what you changed. Food & drinks you fill in straight away, under **Vouchers**; how the amounts are split into vouchers you change there with **Divide vouchers**.\n3. Choose how the contribution is settled: invoice, in kind or a combination.\n4. Fill in the invoice reference and notes if needed. Notes go into the email to the sponsor and are part of what they accept.\n5. Click save. The confirmation email window opens straight away.",
        },
      },
      {
        q: {
          nl: "Ik wil de sponsor andere voordelen geven dan de formule.",
          en: "I want to give the sponsor other benefits than the formula.",
        },
        a: {
          nl: "Dat kan, maar een admin moet het goedkeuren voor de sponsor de overeenkomst krijgt.\n\n1. Klik in de overeenkomst **Voordelen aanpassen** en wijzig wat nodig is. Je ziet meteen wat afwijkt van de formule; **Terug naar formule** zet alles terug.\n2. Klik **Overeenkomst opslaan**. De admins krijgen een mail met wat er afwijkt.\n3. Zet de bevestigingsmail klaar zoals altijd en klik **Klaarzetten tot goedkeuring**.\n\nZodra een admin goedkeurt, vertrekt die mail naar de sponsor, met jou in cc. Tot dan staat de overeenkomst op **wacht op goedkeuring** en kan de sponsor ze niet aanvaarden. Een overeenkomst **Op maat**, of zonder formule, moet altijd langs een admin, ook zonder voordelen: die keurt dan ook de prijs goed. Pas je de prijs later aan, dan wacht ze opnieuw.\n\nVouchers eten & drinken vallen hier niet onder: die zitten nooit in een formule en komen altijd bovenop de bijdrage. Die vul je vrij in, zonder goedkeuring.",
          en: "You can, but an admin has to approve it before the sponsor gets the agreement.\n\n1. In the agreement, click **Change the benefits** and change what's needed. You'll see straight away what differs from the formula; **Back to formula** puts it all back.\n2. Save the agreement. The admins get an email with what differs.\n3. Prepare the confirmation email as always and click **Prepare until approved**.\n\nAs soon as an admin approves, that email goes to the sponsor, with you in cc. Until then the agreement shows **waiting for approval** and the sponsor can't accept it. An **Op maat** agreement, or one without a formula, always needs an admin, even with no benefits: they approve the price too. Change the price later and it waits again.\n\nFood & drink vouchers don't count here: they're never in a formula and always come on top of the contribution. You fill them in freely, without approval.",
        },
      },
      {
        q: {
          nl: "Een overeenkomst wacht op mijn goedkeuring.",
          en: "An agreement is waiting for my approval.",
        },
        adminOnly: true,
        a: {
          nl: "Een teamlid gaf een sponsor andere voordelen dan de formule. Je kreeg daarover een mail, en op het **Overzicht** staat een melding.\n\n1. Klik bij de melding **Bekijken**, of kies in **Overeenkomsten** de status **Wacht op goedkeuring**.\n2. Klik **Goedkeuren**. Je ziet wat er afwijkt en naar wie de klaargezette mail gaat.\n3. Bevestig. De mail vertrekt naar de sponsor, met de verantwoordelijke in cc. Stond er nog geen mail klaar, dan opent het venster om ze zelf te versturen.\n\nNiet akkoord? Open de overeenkomst en pas de voordelen aan, of zet ze **Terug naar formule**. Wat je als admin opslaat, is meteen goedgekeurd.",
          en: "A team member gave a sponsor other benefits than the formula. You got an email about it, and there's a notice on the **Overview**.\n\n1. Click **View** in the notice, or pick the status **Waiting for approval** in **Agreements**.\n2. Click **Approve**. You'll see what differs and who the prepared email goes to.\n3. Confirm. The email goes to the sponsor, with the responsible in cc. If no email was prepared yet, the window opens to send it yourself.\n\nNot okay? Open the agreement and change the benefits, or put them **Back to formula**. What you save as an admin is approved straight away.",
        },
      },
      {
        q: {
          nl: "Hoe werkt de bevestigingsmail?",
          en: "How does the confirmation email work?",
        },
        a: {
          nl: "De bevestigingsmail is het contract. Elke ontvanger krijgt een eigen mail met een persoonlijke link die 14 dagen werkt en meteen aanmeldt in het portaal, waar de sponsor de overeenkomst aanvaardt.\n\n- Vink de juiste contactpersonen aan en lees onderwerp en bericht na.\n- Verwijder of wijzig de regel met de link niet, anders krijgt de sponsor geen persoonlijke link.\n- Gebruik **Als verzonden markeren** enkel als je de mail al op een andere manier verstuurde.",
          en: "The confirmation email is the contract. Every recipient gets their own email with a personal link that works for 14 days and signs them straight into the portal, where the sponsor accepts the agreement.\n\n- Tick the right contact persons and read through the subject and message.\n- Don't remove or change the line with the link, or the sponsor won't get a personal link.\n- Only mark it as sent if you already sent the email some other way.",
        },
      },
      {
        q: {
          nl: "Een sponsor koos zelf een formule in het portaal.",
          en: "A sponsor chose a formula in the portal themselves.",
        },
        a: {
          nl: "De overeenkomst krijgt het label **aangevraagd door sponsor** en verschijnt als melding op het **Overzicht**.\n\n1. Open de overeenkomst, kijk ze na en pas aan waar nodig.\n2. Klik **Overeenkomst opslaan**. Dat is je bevestiging.\n3. Verstuur daarna zelf de bevestigingsmail via **E-mail** in het tabblad **Sponsoring** van de sponsor.",
          en: "The agreement is labelled as requested by the sponsor and shows up as a notice on the **Overview**.\n\n1. Open the agreement, review it and change what's needed.\n2. Save the agreement. That is your confirmation.\n3. Then send the confirmation email yourself from the sponsor's **Sponsoring** tab.",
        },
      },
      {
        q: {
          nl: "Bij een overeenkomst staat \"⚠ gewijzigd\".",
          en: "An agreement shows \"⚠ changed\".",
        },
        a: {
          nl: "De overeenkomst is aangepast nadat de sponsor ze aanvaardde. Hoe de sponsor de vouchers verdeelt telt daarbij niet mee, extra eten- & drankvouchers wel.\n\n1. Klik in het tabblad **Sponsoring** van de sponsor op **⚠ gewijzigd**. Je ziet de voorwaarden zoals aanvaard naast de huidige.\n2. Klik **Opnieuw laten aanvaarden** en bevestig. De aanvaarding wordt gewist.\n3. Verstuur de bevestigingsmail opnieuw.",
          en: "The agreement was changed after the sponsor accepted it. How the sponsor divides the vouchers doesn't count, extra food & drink vouchers do.\n\n1. In the sponsor's **Sponsoring** tab, click the ⚠ marker. You'll see the terms as accepted next to the current ones.\n2. Ask for it to be accepted again and confirm. The acceptance is cleared.\n3. Send the confirmation email again.",
        },
      },
      {
        q: {
          nl: "Ik kan geen overeenkomst maken voor een sponsor of editie.",
          en: "I can't create an agreement for a sponsor or an edition.",
        },
        a: {
          nl: "Je kan enkel een overeenkomst maken voor een sponsor waarvoor jij verantwoordelijk bent; andere sponsors staan niet in de keuzelijst. Enkel actieve edities zijn beschikbaar, en een sponsor heeft maar één overeenkomst per editie. Bestaat er al een, open die dan met **Bestaande overeenkomst openen**.",
          en: "You can only create an agreement for a sponsor you're responsible for; other sponsors aren't in the list. Only active editions are available, and a sponsor has only one agreement per edition. If there already is one, open it from the notice in the form.",
        },
      },
    ],
  },
  {
    title: { nl: "Voor beheerders", en: "For admins" },
    adminOnly: true,
    entries: [
      {
        q: { nl: "Hoe begin ik een nieuw seizoen?", en: "How do I start a new season?" },
        a: {
          nl: "Altijd bij **Beheer → Edities & formules**. Maak een nieuwe editie aan (naam, data, locatie) en voeg haar formules toe. Een nieuwe editie is meteen actief.\n\nEen formule aanpassen of verwijderen verandert niets aan bestaande overeenkomsten. Een editie verwijderen wist ook al haar formules, overeenkomsten en vouchers.",
          en: "Always in **Admin → Editions & formulas**. Create a new edition (name, dates, location) and add its formulas. A new edition is active straight away.\n\nChanging or deleting a formula doesn't affect existing agreements. Deleting an edition also deletes all its formulas, agreements and vouchers.",
        },
      },
      {
        q: {
          nl: "Hoe verdeel ik de sponsors over het team?",
          en: "How do I divide the sponsors among the team?",
        },
        a: {
          nl: "Open de sponsor, klik **Bewerken** en kies de **Verantwoordelijke (ons team)**. Vanaf dan kan die persoon de sponsor, zijn contactpersonen en overeenkomsten wijzigen; andere gebruikers kunnen dat niet meer.\n\nEen sponsor zonder verantwoordelijke kan enkel een beheerder wijzigen. Met **Lijst importeren** wijs je de verantwoordelijke meteen toe: vul in de kolom **Verantwoordelijke (ons team)** de naam of het e-mailadres van een teamlid in. Sponsors zonder herkende verantwoordelijke komen niet toegewezen binnen: kies na een import **Niet toegewezen** in de lijst en wijs ze toe.",
          en: "Open the sponsor, click **Edit** and choose the **Responsible (our team)**. From then on that person can change the sponsor, its contact persons and agreements; other users no longer can.\n\nOnly an admin can change a sponsor without a responsible person. With **Import list** you assign the responsible straight away: fill in a team member's name or email address in the **Responsible (our team)** column. Sponsors without a recognised responsible come in unassigned: after an import, choose **Not assigned** in the list and assign them.",
        },
      },
      {
        q: {
          nl: "Hoe importeer ik sponsors of contactpersonen uit een spreadsheet?",
          en: "How do I import sponsors or contact persons from a spreadsheet?",
        },
        a: {
          nl: "1. Klik **Lijst importeren** in **Sponsors**, of in **Contactpersonen** voor contactpersonen van sponsors die al in de tool staan.\n2. Nog geen bestand? Klik **Sjabloon downloaden**. Vul het eerste tabblad in, één rij per sponsor of contactpersoon. Het tabblad **Uitleg** zegt per kolom wat erin hoort en of ze verplicht is.\n3. Laad het Excel- (.xlsx) of CSV-bestand op. De kolommen worden herkend; kijk ze na en pas aan waar nodig.\n4. Kijk het voorbeeld na en klik de knop om te importeren.\n\nBij sponsors:\n- Een sponsor die al bestaat, met hetzelfde BTW-nummer of dezelfde naam, wordt overgeslagen.\n- Per rij geef je eventueel één contactpersoon mee.\n- In de kolom **Verantwoordelijke (ons team)** vul je de volledige naam, het e-mailadres of de voornaam van een teamlid in. Het sjabloon somt het team op.\n\nBij contactpersonen wordt de sponsor gezocht op de bedrijfsnaam, precies zoals die in de tool staat. Een rij met een onbekende sponsor wordt overgeslagen: importeer die sponsor eerst. Een contactpersoon zonder voorkeuren in het bestand krijgt enkel informatie.\n\nEr vertrekt geen mail en niemand krijgt portaaltoegang. Die geef je nadien met **Portaaltoegang geven** in **Contactpersonen**.",
          en: "1. Click **Import list** in **Sponsors**, or in **Contacts** for contact persons of sponsors already in the app.\n2. No file yet? Click **Download template**. Fill in the first sheet, one row per sponsor or contact person. The **Instructions** sheet says per column what goes in it and whether it's required.\n3. Upload the Excel (.xlsx) or CSV file. The columns are recognised; check them and adjust where needed.\n4. Check the preview and click the import button.\n\nFor sponsors:\n- A sponsor that already exists, with the same VAT number or name, is skipped.\n- Each row can bring one contact person along.\n- In the **Responsible (our team)** column, fill in a team member's full name, email address or first name. The template lists the team.\n\nFor contact persons, the sponsor is matched on the company name, exactly as it is in the app. A row with an unknown sponsor is skipped: import that sponsor first. A contact person without preferences in the file gets information only.\n\nNo email goes out and nobody gets portal access. You give that afterwards from the **Contacts** tab.",
        },
      },
      {
        q: {
          nl: "Hoe importeer ik overeenkomsten uit een spreadsheet?",
          en: "How do I import agreements from a spreadsheet?",
        },
        a: {
          nl: "1. Klik **Lijst importeren** in **Overeenkomsten**.\n2. Nog geen bestand? Klik **Sjabloon downloaden**. Het tabblad **Uitleg** zegt per kolom wat erin hoort en somt de formules per editie op: gebruik die namen precies zo.\n3. Laad het bestand op, kijk de kolommen na en kies de editie voor rijen zonder editie.\n4. Kijk het voorbeeld na en klik de knop om te importeren.\n\nPer rij:\n- De sponsor wordt gezocht op BTW-nummer, anders op bedrijfsnaam. Een onbekende sponsor wordt overgeslagen, niet aangemaakt.\n- De editie is haar naam of enkel het jaar.\n- De formule brengt haar prijs en voordelen mee, zoals in het formulier. Een bedrag vervangt de prijs; zonder formule of bij **Op maat** is het verplicht.\n- In de kolommen met voordelen (VIP-tickets, drankvouchers, eten & drinken, folder, affiche, website, banners, LED-boarding) vul je enkel in wat anders is dan de formule. Een lege cel laat het zoals in de formule. Eten & drinken komt bovenop de formule. Een ander bedrag aan drankvouchers wordt één voucher: verdeel het nadien in de overeenkomst met **Vouchers verdelen**.\n\nWat afwijkt van de formule, is meteen goedgekeurd op jouw naam. Een rij die niet klopt (onbekende sponsor, editie of formule, een onleesbaar bedrag of voordeel, of een sponsor die al een overeenkomst heeft voor die editie) wordt overgeslagen; het voorbeeld zegt waarom, nog voor er iets bewaard wordt. Had een sponsor afgezegd voor die editie, dan zie je dat in het voorbeeld: de import haalt die afzegging weg.\n\nEr vertrekt geen mail, ook niet naar de sponsors. Verstuur de bevestigingsmail per overeenkomst zodra ze klaar is.",
          en: "1. Click **Import list** in **Agreements**.\n2. No file yet? Click **Download template**. The **Instructions** sheet says per column what goes in it and lists the formulas per edition: use those names exactly.\n3. Upload the file, check the columns and pick the edition for rows without one.\n4. Check the preview and click the import button.\n\nPer row:\n- The sponsor is matched on VAT number, otherwise on company name. An unknown sponsor is skipped, not created.\n- The edition is its name or just its year.\n- The formula brings its price and benefits along, as in the form. An amount replaces the price; without a formula or with **Op maat** it's required.\n- In the benefit columns (VIP tickets, drink vouchers, food & drink, folder, poster, website, banners, LED boarding), fill in only what differs from the formula. An empty cell leaves it as in the formula. Food & drink comes on top of the formula. A different drink voucher amount becomes one voucher: split it later in the agreement with **Divide vouchers**.\n\nWhat differs from the formula comes in approved, in your name. A row that doesn't add up (unknown sponsor, edition or formula, an unreadable amount or benefit, or a sponsor that already has an agreement for that edition) is skipped; the preview says why, before anything is saved. If a sponsor had declined that edition, the preview shows it: the import withdraws the decline.\n\nNo email goes out, not to the sponsors either. Send the confirmation email per agreement once it's ready.",
        },
      },
      {
        q: {
          nl: "Iemand van het team vraagt toegang.",
          en: "Someone on the team asks for access.",
        },
        a: {
          nl: "Open **Beheer → Team**. De aanvraag staat in de kaart **Toegangsaanvragen**. Kies **Toegang als user** of **Toegang als admin**; de persoon krijgt meteen toegang en een mail.\n\nJe kan ook zelf een account aanmaken met **+ Nieuw account**. Dat is meteen goedgekeurd, en de persoon krijgt een mail in zijn eigen taal, met jouw naam erin en hoe hij zich aanmeldt. Kon die mail niet vertrekken, dan zegt de tool dat: klik dan **Uitnodiging kopiëren** naast de naam en stuur de tekst zelf door.",
          en: "Open **Admin → Team**. The request is in the access requests card. Grant access as user or as admin; the person gets access and an email straight away.\n\nYou can also create an account yourself with **+ New account**. It's approved straight away, and the person gets an email in their own language, naming you and saying how to sign in. If that email couldn't be sent, the app says so: click **Copy invite** next to their name and send the text yourself.",
        },
      },
      {
        q: { nl: "Hoe maak ik de vouchers aan?", en: "How do I issue the vouchers?" },
        a: {
          nl: "1. Ga naar **Vouchers**, kies de editie en klik **Genereren uit overeenkomsten**.\n2. Maak elke voucher aan in Tickoweb en plak de code in de kolom **Vouchercode**.\n3. Verstuur de voucher vanuit Tickoweb of per mail.\n4. Vink de vouchers aan en klik **Aanmaken & versturen**. De sponsor ziet ze dan in het portaal.\n\nGenereer pas als de sponsor de verdeling van de vouchers heeft afgerond: daarna kan die ze niet meer wijzigen.",
          en: "1. Go to **Vouchers**, pick the edition and generate them from the agreements.\n2. Create each voucher in Tickoweb and paste its code into the voucher code column.\n3. Send the voucher from Tickoweb or by email.\n4. Tick the vouchers and mark them as created and sent. The sponsor then sees them in the portal.\n\nOnly generate once the sponsor has finished dividing their vouchers: after that they can't change the split.",
        },
      },
      {
        q: {
          nl: "Een sponsor wil de verdeling van vouchers nog wijzigen.",
          en: "A sponsor still wants to change how their vouchers are divided.",
        },
        a: {
          nl: "Zodra vouchers aangemaakt of verzonden zijn, ligt de verdeling vast. Annuleer de betrokken vouchers (ook in Tickoweb), laat de sponsor de verdeling aanpassen en genereer ze opnieuw.",
          en: "Once vouchers are created or sent, the split is fixed. Cancel the vouchers concerned (in Tickoweb too), let the sponsor adjust the split and generate them again.",
        },
      },
      {
        q: {
          nl: "Ik kan \"Factuur aangemaakt\" niet aanvinken.",
          en: "I can't tick \"Invoice created\".",
        },
        a: {
          nl: "De sponsor vraagt een referentie op de factuur en die is nog niet ingevuld. Vul de referentie in bij **Facturatie**; daarna kan je het vakje aanvinken.",
          en: "The sponsor needs a reference on the invoice and it hasn't been filled in yet. Fill in the reference under **Invoicing**; then you can tick the box.",
        },
      },
      {
        q: {
          nl: "Waar vind ik de logo's voor de folder?",
          en: "Where do I find the logos for the folder?",
        },
        a: {
          nl: "In het tabblad **Folder**. Enkel een logo dat de sponsor voor de folder aanduidde, telt mee. Je kan alle logo's downloaden of ze naar de gedeelde Drive-map van het ontwerpteam kopiëren.",
          en: "In the **Folder** tab. Only a logo the sponsor marked for the folder counts. You can download all logos or copy them to the design team's shared Drive folder.",
        },
      },
      {
        q: {
          nl: "Hoe zie ik de tool zoals een gewone gebruiker?",
          en: "How do I see the app the way a regular user does?",
        },
        a: {
          nl: "Klik rechtsboven **Bekijken als gebruiker**. Wat je in die modus wijzigt, wijzig je echt. Je gaat terug met **Terug als beheerder**.",
          en: "Click **View as user** at the top right. Anything you change in that mode really changes. You go back from the bar at the top.",
        },
      },
      {
        q: {
          nl: "Kan ik een verwijderde sponsor of overeenkomst terughalen?",
          en: "Can I restore a deleted sponsor or agreement?",
        },
        a: {
          nl: "Nee. Een sponsor verwijderen wist ook zijn contactpersonen, overeenkomsten en vouchers; dat kan niet ongedaan gemaakt worden. Vouchers die al in Tickoweb bestaan, blijven daar bestaan: annuleer ze daar zelf. In **Beheer → Audit log** zie je wel wie wat wanneer wijzigde.",
          en: "No. Deleting a sponsor also deletes its contact persons, agreements and vouchers; it can't be undone. Vouchers that already exist in Tickoweb stay there: cancel them there yourself. **Admin → Audit log** does show who changed what and when.",
        },
      },
      {
        q: {
          nl: "Hoe maak ik een back-up van alle gegevens?",
          en: "How do I make a backup of all data?",
        },
        a: {
          nl: "Open **Beheer → Back-up** en klik **Back-up downloaden**. Je krijgt één Excel-bestand met een tabblad per soort gegevens: sponsors, contactpersonen, overeenkomsten, afzeggingen, edities, formules, vouchers, de lijst van logo's, het team, de instellingen en de audit log. Het eerste tabblad zegt wanneer en door wie de back-up gemaakt is en hoeveel rijen elk tabblad telt.\n\nDe logobestanden zelf zitten er niet in, enkel de lijst ervan.\n\nHet bestand bevat de gegevens van alle sponsors en contactpersonen en de codes van de vouchers: bewaar het op een veilige plek en deel het niet.",
          en: "Open **Admin → Backup** and click **Download backup**. You get one Excel file with a sheet for each kind of data: sponsors, contact persons, agreements, declines, editions, formulas, vouchers, the list of logos, the team, the settings and the audit log. The first sheet says when and by whom the backup was made and how many rows each sheet holds.\n\nThe logo files themselves aren't in it, only their list.\n\nThe file holds the details of every sponsor and contact person and the voucher codes: keep it somewhere safe and don't share it.",
        },
      },
    ],
  },
];

export const sponsorFaq = (lang: Language): FaqSection[] =>
  SPONSOR_FAQ.map((s) => ({
    title: s.title[lang],
    entries: s.entries.map((e) => ({ q: e.q[lang], a: e.a[lang] })),
  }));

export const teamFaq = (lang: TeamLanguage, admin: boolean): FaqSection[] =>
  TEAM_FAQ.filter((s) => admin || !s.adminOnly)
    .map((s) => ({
      title: s.title[lang],
      entries: s.entries.filter((e) => admin || !e.adminOnly).map((e) => ({ q: e.q[lang], a: e.a[lang] })),
    }))
    .filter((s) => s.entries.length > 0);
