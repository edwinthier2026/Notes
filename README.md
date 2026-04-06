# Notes

Nieuwe projectbasis voor Notes, opgezet op de layout- en gridstructuur van `NinoxPlanning`, maar zonder Ninox- of Azure-afhankelijkheden.

De UI- en layoutstandaarden van `NinoxPlanning` gelden ook hier. Zie:

- [AGENTS.md](/C:/Edwin/Notes/AGENTS.md)
- [docs/PROJECT_STANDAARDEN.md](/C:/Edwin/Notes/docs/PROJECT_STANDAARDEN.md)

## Wat zit er nu in

- Vite + React + TypeScript frontend
- Sidebar, dashboard, grids en modals in dezelfde stijl als het bronproject
- Notes CRUD met demo-fallback zolang MariaDB nog niet geconfigureerd is
- Mailjet testmail endpoint via de Mailjet API
- MariaDB status- en opslaglaag voor notities

## Node versie

Gebruik Node.js `22` LTS.

## Installatie

```powershell
npm install
npm run dev
```

De app draait dan op `http://127.0.0.1:8080`.

## Login

Login controleert in `Notes` via de MariaDB tabel `gebruikers`.

## Omgevingsvariabelen

Kopieer `.env.example` naar `.env` en vul waar nodig aan.

Belangrijk:

- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`
- `MAILJET_FROM_EMAIL`
- `MAILJET_FROM_NAME`
- `MARIADB_HOST`
- `MARIADB_PORT`
- `MARIADB_USER`
- `MARIADB_PASSWORD`
- `MARIADB_DATABASE`

## Build

```powershell
npm run build
```

## Opmerking

Als MariaDB nog niet bereikbaar is, blijft de app voor notities bruikbaar met in-memory demo-data. De layoutstandaard blijft daarbij identiek aan `NinoxPlanning`; alleen de backendtechniek verschilt.
