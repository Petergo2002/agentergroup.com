# Återställa Widget Preview Layout (Bubble & Raw URL)

Målet är att återställa widget-förhandsgranskningen så att den placeras i hörnet i en bubbel-vy, precis som den gör på en riktig hemsida, istället för att ta upp hela fönstret som en inbäddad sida. Vi ska också se till att det finns en möjlighet att visa den "råa" URL-vyn ("Raw URL") precis som tidigare.

## User Review Required

> [!IMPORTANT]
> Vänligen granska denna plan innan jag implementerar koden. Planen innebär att en toggle (växlare) läggs till för att kunna välja mellan "Simulerad Sida" (där widgeten ligger i hörnet) och "Fullskärm/Raw" (som den fungerar nu). Konceptet är att ladda widgetens `loader.js` (det sanna installationsskriptet) in i en isolerad HTML i förhandsvisningen när den ska var i hörnet. Är detta upplägget vad du hade i åtanke?

## Proposed Changes

---

### UI Components

#### [MODIFY] `src/components/widgets/builder/WidgetDevicePreview.tsx`
- Lägg till ett state (t.ex. `previewLayout = 'corner' | 'raw'`) som standard kan vara `'corner'`.
- Anpassa överskriften "Pulse Live Preview" så att den nu har små knappar intill för att byta mellan **"Inbäddad" (Bubbla)** och **"Raw" (Fullskärm)**.
- Lägg också eventuellt till en ikon/knapp med länk-ikon för att kunna öppna den råa URL:en i en ny flik (`target="_blank"`), vilket matchar det gamla utseendet.
- **För "corner" mode:** Ändra iFramen så att den använder `srcDoc` för att injicera en tom låtsas-webbsida, där vi laddar `<script src="${widgetOrigin}/loader.js" data-widget="..." ...></script>`. Detta driver upp den äkta flytande "bubbel"-vyn i nedre högra hörnet med exakt det skript kunderna använder.
- **För "raw" mode:** Använd den nuvarande URL-baserade lösningen som laddar Helskärms-inbäddningen.

## Open Questions

- Vill du att "Inbäddad (Bubbla)" är valt som standard när sidan laddas, framför Raw? (Det verkar mest konsekvent med din önskan).
- I den inbäddade vyn med bubblan i hörnet, vill du att själva låtsas-hemsidans ska ha text/färg ("Simulerad Webbplats") i bakgrunden för att det ska vara tydligt, eller ska den bara vara en ren yta?

## Verification Plan

### Manual Verification
1. Starta widget-v2 och huvudappen lokalt.
2. Gå in i Byggaren för en agent.
3. Säkerställ att förhandsvisningen (Live Preview) startar med en liten chattbubbla i nere i högra hörnet per automatik.
4. Öppna bubblan och verifiera att ändringar (via inputs) reflekteras i förhandsvisningen.
5. Använd toggle-knappen för att byta till RAW-vyn (Fullskärm som täcker hela rutan).
6. Klicka på länk-ikonen för att öppna den råa URL:en i en extern flik.
