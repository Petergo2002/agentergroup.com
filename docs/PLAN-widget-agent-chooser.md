# Återställa Widgetens Agent-väljare (HomeTab) till en Användarvänlig Vy

När användare öppnar widgeten och det finns flera agenter kopplade, möts de för närvarande av ett utseende som påminner om en administratörspanel (med kolumner för "Prompter", "Status toggles", "Utkast" osv). Detta är inte optimalt för slutkunder på en hemsida. Målet är att återställa denna vy till en stilren, kund-vänlig chattmeny där besökaren enkelt kan välja vem de vill prata med, baserat på agentens namn och beskrivning.

## Proposed Changes

---

### UI Components

#### [MODIFY] `apps/widget-v2/src/components/HomeTab.tsx`
- **Ta bort Administrativt Gränssnitt**: 
  - Ta bort tabb-raden ("Alla", "Aktiva", "Utkast").
  - Ta bort tabell-huvudet ("Agent", "Prompter", "Status").
  - Ta bort on/off-toggles ("Status switch") från agent-korten.
  - Ta bort texten för antal prompter.
  - Ta bort paginering-bannern längst ner ("Visar X av Y agenter").
- **Implementera Kundvänliga Agent-kort ("Chooser Mode")**:
  - När `isChooserMode` är sant ska skärmen visa en ren och inbjudande lista av specialister/agenter (t.ex. i form av klickbara "kort" eller rader).
  - Varje kort ska innehålla:
    1. Agentens namn (`agent.label`).
    2. Agentens beskrivning (`agent.description`) så att kunden förstår vad agenten hjälper till med.
    3. En eventuell ikon/avatar om det kan härledas, annars en subtil avatar-placeholder (t.ex. en stilig färg-blobb eller ikon) för att ge liv åt UI:t.
    4. En subtil pil eller "Chatta nu"-indikator för att uppmuntra till interaktion.
  - Förbättra typografin och rymden mellan korten för att svara till widgetens övergripande design ("Premium/Vibe coding").

## Open Questions

> [!NOTE]
> Finns det någon specifik ikon eller stil ni använde för avatarer 'som det var förr' (innan det ändrades till den svarta status-pricken), eller ska jag bygga en elegant, färgkodad ikon/avatar-behållare utifrån agentens namn? 

## Verification Plan

### Manual Verification
1. Öppna Live Preview (Bubblan i högra hörnet) för en widget som har fler än 1 aktiv agent.
2. Bekräfta att menyvalet för vilken agent man vill chatta med ser ut som en inbjudande app-vy och att man tydligt kan läsa namnen och beskrivningarna.
3. Klicka på en av agenterna och verifiera att vi navigerar rakt in i chatt-vyn för just den agenten.
