# Flytta till avenro.se — Vercel och one.com

Förberett 2026-09-07. Kodens domänadresser har uppdaterats. Logga, Agentergroup/Milo-namn och övrig design är oförändrade. Därefter har DNS och Vercel konfigurerats genom användarens inloggade webbläsare, enligt status nedan. Ingen ny kod har publicerats och inga databasposter har ändrats.

## Genomfört i Vercel och one.com 2026-09-07

- `agentergroup-realdashboard`: `avenro.se` ansluten till Production. `www.avenro.se` ändrad från att vara huvuddomän till 308-omdirigering mot `avenro.se`. Båda visar **Valid Configuration**.
- Befintliga one.com-poster för huvuddomänen kontrollerade: A för `avenro.se` = `216.198.79.1`; CNAME för `www` = `e9ae8931e04bc571.vercel-dns-017.com`. De matchar Vercels projektvärden. one.coms gamla standard-A-poster är avstängda.
- `agentergroup-realwidget`: `widget.avenro.se` tillagd till Production. CNAME skapad hos one.com: `widget` → `8a7d322dc7b94d8e.vercel-dns-017.com`. Rätt byggmapp `apps/widget-v2` och Vite verifierade.
- Huvudprojektets befintliga `NEXT_PUBLIC_APP_URL` ändrad till `https://avenro.se`; `NEXT_PUBLIC_WIDGET_APP_URL` och `WIDGET_APP_URL` ändrade till `https://widget.avenro.se`. Variablernas befintliga omfattning **All Environments** bevarad.
- Widgetprojektets befintliga `VITE_API_BASE` ändrad till `https://avenro.se`, också med befintlig omfattning **All Environments**. Vercel bekräftade sparningen. Nya byggen behövs för att variablerna ska slå igenom.
- Webbläsarkontroll: `https://www.avenro.se` leder till `https://avenro.se/login?redirectTo=%2Fdashboard`. `https://widget.avenro.se` svarar över HTTPS med `Missing widget key.`, vilket är väntat utan nyckel. Fullständig chat/inloggning är inte testad.
- Widgetdomänen passerade DNS/certifikatfasen men visar fortfarande **Proxy Status Unknown** i Vercel: dess proxykontroll misslyckades även efter en uppdatering. Webbplatsen svarar över HTTPS; kontrollpanelen behöver följas upp innan statusen kan kallas helt grön.

**Kvar för publicering:** Vercels nuvarande huvuddeployment är `a6bba19` från 1 augusti och widgetdeploymenten `ffb7d48` från 6 augusti. De innehåller inte de lokala septemberändringarna. Ingen Redeploy av dessa äldre versioner startades. Publicera rätt aktuell kodversion i båda projekten; fortsätt sedan med Supabase, e-post, webhooks och befintliga widgetlänkar enligt checklistan. Ingen `EMAIL_FROM_ADDRESS` hittades i huvudprojektets variabellista; Resend/Supabase SMTP har inte konfigurerats i denna webbläsarsession. Gamla widgetdomänen är inte borttagen.

Verifierat lokalt: 241 tester, TypeScript, lint och båda produktionsbyggena passerar. Byggda Widget V2-filer innehåller den nya API-adressen och inga gamla domänreferenser. HTTP-kontroll av startsidan, integritetssidan, villkoren, robots och sitemap passerar med produktionsadresserna. Inloggning, e-post, kundembeds och webhooks behöver fortfarande sluttestas på de riktiga domänerna efter kontokonfigurationen nedan.

## Adresserna vi använder

| Adress | Innehåll | Vercel-projekt |
| --- | --- | --- |
| `https://avenro.se` | Landing page, dashboard, inloggning och API | Befintliga Next.js-projektet, repository root `.` |
| `https://www.avenro.se` | Omdirigering till `https://avenro.se` | Samma Next.js-projekt |
| `https://widget.avenro.se` | Widget V2 och `/loader.js` | Separata widgetprojektet, root `apps/widget-v2` |

Dashboarden nås på `https://avenro.se/dashboard`. Du behöver inte köpa en separat domän för widgeten. Koppla inte huvuddomänen till ett eventuellt gammalt statiskt landing-page-projekt; det saknar appens API.

## 1. Förbered båda Vercel-projekten

Öppna befintliga Next.js-projektet. Kontrollera Git-koppling och att den kod som publiceras innehåller dessa ändringar. Många tidigare ändringar finns också lokalt i arbetskopian; publicera inte av misstag en äldre Git-version och förvänta dig att lokala ändringar följer med.

Under **Settings → Environment Variables**, välj **Production** och sätt:

```dotenv
NEXT_PUBLIC_APP_URL=https://avenro.se
NEXT_PUBLIC_WIDGET_APP_URL=https://widget.avenro.se
EMAIL_FROM_ADDRESS="Agentergroup <noreply@avenro.se>"
```

I Vercels enskilda värdefält skriver du `Agentergroup <noreply@avenro.se>` utan de omgivande citattecknen. Avsändaren fungerar först när domänen är verifierad i Resend (steg 5).

Om `WIDGET_APP_URL` finns: ta bort den gamla aliasvariabeln eller sätt den till `https://widget.avenro.se`. Behåll övriga befintliga nycklar och Supabase-projektet.

Öppna det separata Widget V2-projektet. Om det saknas, importera samma Git-repository som ett nytt Vercel-projekt med **Root Directory: `apps/widget-v2`**. Dess `vercel.json` anger `npm run build` och output `dist`; det ska inte byggas som Next.js. Sätt i **Production**:

```dotenv
VITE_API_BASE=https://avenro.se
```

Widgetprojektet behöver inte appens serverhemligheter. Kontrollera även att de publika widgetfilerna och produktions-API:t kan nås utan Vercel-inloggning.

Publicera om **båda** projekten efter ändringarna. Next.js publika miljövariabler och Vites variabler byggs in i klientfilerna. Enbart sparade variabler räcker inte. Lokal utveckling behåller localhost-adresserna; använd separata, sammanhängande adresser för Preview om du behöver en testmiljö.

## 2. Lägg till domänerna i Vercel

I Next.js-projektets **Settings → Domains**: lägg till `avenro.se` och `www.avenro.se`. Välj `avenro.se` som adressen som serverar Production och sätt `www.avenro.se` att omdirigera dit.

I Widget V2-projektets **Settings → Domains**: lägg till `widget.avenro.se` som Production-domän. Den ska servera widgetprojektet, inte omdirigera till huvuddomänen.

Vercel visar de DNS-poster som just dessa projekt kräver. Kopiera värdena därifrån; använd inte generiska IP-adresser eller CNAME-exempel från äldre guider. Se [Vercels domänguide](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## 3. Lägg in DNS hos one.com

Behåll DNS/namnservrar hos one.com. Öppna kontrollpanelen för `avenro.se`, gå till **DNS settings / DNS-inställningar → DNS records / DNS-poster** (kan ligga under avancerade inställningar).

| Typ | Hostname hos one.com | Värde att fylla i |
| --- | --- | --- |
| A | Lämna tomt för själva `avenro.se` | IP-adressen som Vercel visar för `avenro.se` |
| CNAME | `www` | CNAME-målet som Vercel visar för `www.avenro.se` |
| CNAME | `widget` | CNAME-målet som widgetprojektet visar för `widget.avenro.se` |

Ange bara målets värdnamn i CNAME-fältet, utan `https://` eller sökväg. TTL kan lämnas på standardvärdet. Om Vercel begär en TXT-post för ägarverifiering, lägg även in exakt dess namn och värde.

Kontrollera befintliga webbposter för samma namn innan du sparar. Ersätt konfliktande A/AAAA/CNAME-poster eller stäng av motsvarande gamla standardpekning från one.com. Lämna e-postens MX-, SPF-, DKIM- och andra orelaterade poster kvar. Använd DNS-poster, inte one.coms URL-vidarebefordran, för att koppla webbappen.

one.com anger tomt Hostname för huvuddomänen i sin [A-postguide](https://help.one.com/hc/en-us/articles/360000799298-How-do-I-create-an-A-record). För CNAME anges subdomänen i Hostname och målet i aliasfältet ([CNAME-guide](https://help.one.com/hc/en-us/articles/360000803517-How-do-I-create-a-CNAME-record)). Kontrollpanelens utseende kan variera.

Gå tillbaka till Vercel och kontrollera att alla tre domäner får giltig konfiguration och HTTPS. DNS-cachar kan göra att det tar tid innan samma resultat syns överallt.

## 4. Uppdatera Supabase-inloggningen

I det befintliga Supabase-projektets **Authentication → URL Configuration**:

- **Site URL:** `https://avenro.se`
- Tillåt appens `https://avenro.se/auth/callback` och `https://avenro.se/auth/confirm` samt deras query-varianter. Appen skickar bland annat `next` och `legalConsent`. Vid behov används avgränsade mönster `https://avenro.se/auth/callback?**` och `https://avenro.se/auth/confirm?**` tillsammans med de exakta URL:erna. I Supabases globsyntax matchar `?` ett tecken; här avgränsas tillägget till respektive callback-sökväg. Testa de faktiska signup-, Google- och reset-länkarna.
- Behåll endast de localhost/Preview-adresser som faktiskt används. Ta bort de gamla produktionsadresserna för domänen du inte kontrollerar vid övergången.

Granska även bekräftelse- och lösenordsåterställningsmallar: hårdkodade länkar till gamla domänen måste ersättas. Läs [Supabases dokumentation om Site URL, redirect-lista och mallar](https://supabase.com/docs/guides/auth/redirect-urls).

Vid Google-inloggning: kontrollera appens hemsida, integritets-/villkorslänkar och auktoriserade domäner i Google Cloud. Behåll Supabase-projektets provider-callback om samma projekt används; ersätt inte en fungerande `supabase.co/auth/v1/callback` med frontend-domänen.

## 5. E-post och integrationer

- **Kontaktadress:** skapa `info@avenro.se` som bevakad brevlåda eller vidarebefordran hos den e-postleverantör du använder. Koden länkar nu dit. Ett domänköp eller en kodändring skapar inte automatiskt en brevlåda.
- **Resend:** lägg till/verifiera `avenro.se` och ange dess exakta DNS-poster hos one.com. Konfigurera utskick från `Agentergroup <noreply@avenro.se>`. Den lokala avsändarinställningen är också uppdaterad; utskick kräver verifiering. Se [Resends domändokumentation](https://resend.com/docs/dashboard/domains/introduction).
- **Supabase SMTP:** uppdatera avsändaradressen separat. `EMAIL_FROM_ADDRESS` i appen ändrar inte inställningen hos Supabase.
- **Composio:** webhookdestination `https://avenro.se/api/composio/webhook`. Behåll eventvalen; matcha `COMPOSIO_WEBHOOK_SECRET` mot destinationens signing secret. Granska egna auth-konfigurationers webbplats-/returadresser. Composios provider-callback på `backend.composio.dev` ska inte bytas till avenro.se.
- **Stripe, om aktiverat:** webhookdestination `https://avenro.se/api/billing/webhook`. Om en ny endpoint skapas behövs dess egen `STRIPE_WEBHOOK_SECRET`; test och live har olika hemligheter ([Stripe webhook-guide](https://docs.stripe.com/webhooks)). Granska även offentliga support-/webbadresser. Produkter, kunder och abonnemang behöver inte återskapas.

Kontrollera att kontoägarskap och återställningsmejl hos leverantörerna inte är beroende av den gamla domänens e-post.

## 6. Befintliga widgetar och slutkontroll

De nya inbäddningskoderna anger både `https://widget.avenro.se/loader.js` och `data-api-url="https://avenro.se"`. Samma widgetnyckel kan fortsätta användas. Redan installerade skript på kundwebbplatser måste bytas där; de ändras inte automatiskt när vi publicerar appen. Kundens egna CSP-regler kan också behöva tillåta de nya adresserna.

Inventera gamla plattformslänkar i befintliga widgetars `privacy_policy_url`, logotypadresser, kontaktlänkar och sparat innehåll. Nya widgetars standardlänkar följer appens URL, men redan sparade databasvärden ändras inte automatiskt. Kundernas egna webbplatsdomäner och anpassade integritetslänkar ska bevaras. Produktionsdata är ännu inte inventerad eller ändrad.

Kontrollera efter publicering:

1. Landing page, `/privacy-policy`, `/terms-of-service`, `/sitemap.xml` och `/robots.txt` använder rätt domän; `www` omdirigerar åt rätt håll.
2. Registrering, bekräftelsemejl, Google-inloggning, lösenordsåterställning och utloggning återkommer till avenro.se.
3. Widget V2 fungerar som fristående länk, inbäddad på en tillåten kunddomän och i dashboardens förhandsvisning; kontrollera chat, leadformulär och aktiverade bilagor/verktyg. Otillåtna domäner ska fortfarande nekas.
4. Inbjudningar, integrationsanslutningar och testleveranser av Composio-/Stripe-webhooks går till rätt mottagare.
5. Distribuera nya länkar/snippets och ta bort inaktuella webhook-/auth-destinationer. Browser-sessioner från gamla domänen följer inte med; befintlig data ligger kvar i samma backend.

Ingen omdirigering från agentergroup.com kan garanteras utan kontroll över den domänen. Den ska inte användas som återställningsväg.
