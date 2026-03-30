# Återställa Widget Preview till Äkta Hörn-bubbla (Ingen Iframe-Inbäddning)

Användaren gillar inte den stora fönster-liknande "Pulse Live Preview"-inbäddningen på sidan, utan vill att widgeten ska existera direkt som en svävande bubbla nere i högra hörnet på själva dashboard-/byggarsidan – exakt så som det är tänkt att se ut på en kundsajt. Den enda UI som ska vara kvar i byggarens spalt är förmågan att starta en "Raw" eller full-hosted preview i en separat flik.

## User Review Required

> [!IMPORTANT]
> Vänligen bekräfta: Innebär detta att jag helt ska *ta bort* den stora svarta förhandsgransknings-boxen i mitten av skärmen (den med "Bubble/Raw"-knapparna och "This frame simulates..."-texten)? Istället kommer du ha en widget svävandes längst ner till höger på skärmen så länge du är inne på "Widget"-fliken. I sidpanelen (eller ovanför formuläret) lägger jag en ren, snygg länk/knapp för att "Öppna Raw / Full Hosted Preview" i en ny flik. Är detta rätt uppfattat?

## Proposed Changes

---

### UI Components

#### [MODIFY] `src/components/widgets/builder/WidgetDevicePreview.tsx`
- Ta bort all HTML och CSS för den stora "Device Preview"-inbäddningen (`<div className="sticky top-[160px]...` etc).
- Ersätt innehållet med en elegant "kort"-komponent vars enda syfte är att ge användaren länkarna "Öppna Raw" eller "Kolla Preview Full Hosted".
- Skapa en `useEffect`-hook (eller använd `next/script`) som dynamiskt injicerar `loader.js` direkt in i byggar-sidans `document.body`.
- Förse det injicerade scriptet med rätt `data-widget`, `data-preview` osv, för att driva live preview-bubblan.
- Implementera `cleanup` så att när man lämnar Builder-sidan anropas `window.__AG_WIDGET_LOADER_INSTANCE__.destroy()` för att ta bort widgeten (så att den inte flyter kvar när man navigerar bort till andra sidor i Dashboarden).

## Verification Plan

### Manual Verification
1. Öppna Widget Buildern för en Agent.
2. Säkerställ att den stora förhandsgranskningsytan är borta och inte tar upp plats.
3. Titta längst ned till höger på skärmen: Där ska nu chat-bubblan sväva.
4. Klicka upp chat-bubblan och testa den "live" i Dashboarden.
5. Klicka på "Open Raw"-knappen i den kvarvarande lilla menyboxen och bekräfta att "full hosted" preview öppnas korrigerat i en ny flik.
6. Lämna Buildern (t.ex. navigera till Home) och verifiera att widgeten försvinner.
