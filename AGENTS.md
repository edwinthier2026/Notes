# Notes Projectregels

## Basisafspraak

- `Notes` volgt voor UI, layout, gridgedrag en formulieropbouw dezelfde projectstandaard als `C:\Edwin\NinoxPlanning`.
- Afwijking zit alleen in de techniek achter de data- en maillaag:
  - geen Ninox;
  - geen Azure SMTP;
  - wel MariaDB;
  - wel Mailjet.

## Layout en UI

- Hoofdpagina's gebruiken dezelfde headeropbouw:
  - `flex items-center gap-2 mb-2`
  - icoon `24px`
  - titel `text-2xl font-semibold text-dc-gray-500`
- Onder pagina- en moduletitels staat geen aparte grijze subtitelregel.
- De linker sidebar blijft compacter dan in `NinoxPlanning`:
  - ongeveer 1/3 smaller;
  - titelblok bovenin blijft `Notes` met daaronder alleen `MariaDB`.
- Hoofdgroepen in de sidebar zijn in `Notes` standaard zichtbaar:
  - `Dashboard`
  - `Relaties`
  - `Notities`
  - `Mailbox`
  - `Database`
  - `Instellingen`
  - alleen `Beheer` blijft rechtenafhankelijk.
- Grids volgen dezelfde standaard:
  - zoekbalk boven de grid;
  - container `bg-white rounded-xl border border-dc-gray-100 overflow-hidden`;
  - klikbare rijen met `dc-zebra-row` en `dc-clickable-row`;
  - formulier openen via klik op de rij, niet via aparte bewerkknop in de grid;
  - open-spinner links in de eerste zichtbare cel, met vaste `w-4 h-4` ruimte;
  - sorteerkoppen via `src/components/ui/SortableTh.tsx`.

## Aanmeldscherm

- Het aanmeldscherm toont in een grijs statuskader de actieve MariaDB-configuratie.
- Volgorde in dit kader:
  - `Server`
  - `Database`
  - `Gebruiker`
- Rechtsboven in dit kader staat een statusbolletje:
  - groen als de MariaDB-verbinding actief is en de server online reageert;
  - rood als de verbinding niet actief is of aanmelden via de server niet beschikbaar is;
  - neutraal tijdens laden.

## Formulieren

- Formulieren met tabs gebruiken projectbreed vaste hoogte en een 16-staps raster.
- Gebruik waar mogelijk:
  - `grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3`
- Waarschuwingen en validatiefouten gebruiken projectbreed:
  - `text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2`
- Bevestigingsvragen gebruiken altijd:
  - `src/components/ui/ConfirmDialog.tsx`

## Invoervelden

- Datumvelden gebruiken:
  - `src/components/ui/DateFieldInput.tsx`
- Numerieke velden gebruiken:
  - `src/components/ui/NumericFieldInput.tsx`
- Comboboxen gebruiken:
  - `src/components/ui/ComboBox.tsx`
- Ja/Nee-velden gebruiken:
  - `src/components/ui/YesNoSlicer.tsx`
- Wachtwoordvelden in beheerformulieren blijven standaard verborgen, met een klein oog-icoon om de waarde tijdelijk leesbaar te maken.

## Datum en numeriek

- Datumvelden gebruiken de projectstandaard kalender-popup:
  - weekendkleur: zaterdag blauw, zondag rood;
  - viewport-veilig positioneren;
  - geen native browserkalender als primaire UX.
- Numerieke velden gebruiken NL-notatie:
  - duizendtallen `.`
  - decimalen `,`
- Numerieke waarden in grids zijn rechts uitgelijnd, inclusief kolomtitel.

## Data-afspraak voor Notes

- Waar `NinoxPlanning` record-id/caption/lookup-logica gebruikt, geldt in `Notes` exact dezelfde UI-werkwijze.
- Alleen de backendbron verandert:
  - lookupdata komt uit MariaDB/API in plaats van Ninox;
  - opslag en lezen lopen via Notes API-routes in `server/notes-api.ts`.
- Authenticatie loopt via MariaDB tabel `gebruikers`.
- Nieuwe modules worden direct op MariaDB-tabellen aangesloten; geen Ninox-resten of Azure-auth meenemen.

## Werkwijze

- Bij nieuwe Notes-programma's eerst bestaande referentie in `NinoxPlanning` controleren.
- Layout, spacing, gridvorm, modalopbouw en componentkeuze blijven gelijk tenzij expliciet anders afgesproken.
- Alleen backend-specifieke code mag afwijken wanneer MariaDB/Mailjet dat vereist.
