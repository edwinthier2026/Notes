# Notes Projectstandaarden

## Overname uit NinoxPlanning

`Notes` gebruikt dezelfde schermopbouw en UI-afspraken als `NinoxPlanning`. Dat betekent:

- dezelfde sidebar- en paginaheader-opbouw;
- geen grijze subtitelregel onder pagina- of moduletitels;
- compactere linker sidebar dan in `NinoxPlanning`, met bovenin alleen `Notes` en `MariaDB`;
- dezelfde gridcontainer, zebra-rijen en klikbare gridregels;
- dezelfde modals, foutkaders en bevestigdialogen;
- dezelfde gedeelde invoercomponenten voor datum, numeriek, combo en ja/nee.

## Verschil met NinoxPlanning

Alleen de technische koppelingen wijken af:

- data-opslag en lookupdata komen uit MariaDB;
- mailverzending loopt via Mailjet;
- logincontrole loopt via MariaDB tabel `gebruikers`;
- Ninox-helpers en Azure-mailflows worden in `Notes` niet gebruikt.

## Navigatieafspraak

- Hoofdgroepen zijn standaard zichtbaar voor iedere gebruiker:
  - `Dashboard`
  - `Relaties`
  - `Notities`
  - `Mailbox`
  - `Database`
  - `Instellingen`
- Alleen `Beheer` blijft rechtenafhankelijk.

## Gedeelde componenten

Gebruik in `Notes` voor nieuwe schermen standaard:

- `src/components/ui/ComboBox.tsx`
- `src/components/ui/DateFieldInput.tsx`
- `src/components/ui/NumericFieldInput.tsx`
- `src/components/ui/YesNoSlicer.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/ui/SortableTh.tsx`
- `src/components/ui/LoadingSpinner.tsx`

## Formulierlayout

- Tabformulieren gebruiken een 16-staps grid.
- Velden en labels volgen dezelfde spacing en borderstijl als in `NinoxPlanning`.
- Formulierhoogte blijft stabiel bij tabwissels.

## Gridstandaard

- Zoekbalk boven de grid.
- Klik op rij opent het formulier.
- Sorteerkoppen via `SortableTh`.
- Open-spinner in de eerste cel zonder layoutverspringing.
- Actie `Verwijderen` gebeurt in het formulier, niet als standaard gridactie.

## Datum, combo en numeriek

- Datumvelden gebruiken de gedeelde kalender met weekendkleur en viewport-veilige popup.
- Comboboxen sorteren standaard alfabetisch op zichtbare label.
- Numerieke invoer en weergave gebruiken NL-notatie.
- Wachtwoordvelden in beheerformulieren blijven standaard verborgen en krijgen een klein oog-icoon om de waarde tijdelijk te tonen.

## Praktische projectafspraak

Bij elk nieuw scherm in `Notes` geldt:

1. Controleer eerst of er in `NinoxPlanning` al een vergelijkbaar scherm of patroon bestaat.
2. Neem layout en UI-werkwijze over.
3. Vervang alleen de Ninox/Azure-techniek door MariaDB/Mailjet-techniek.
