# Snaptie

Snaptie is a multi-tenant platform for building interactive QR codes. A business
creates a QR code, adds a set of buttons to it, and each button opens different
content such as a menu, a PDF guide, a Wi-Fi shortcut, a video or an external
link. Every scan is recorded so the business can understand how its codes are
being used.

A single QR code can therefore replace a printed leaflet, a reception desk
hand-out or a product label, and its content can be updated at any time without
reprinting anything.

## Tech stack

- **Next.js 15** (App Router) and **React 18**
- **TypeScript**
- **PostgreSQL** with **Prisma** as the ORM
- **Atlassian Design System** for the user interface

## Data model

The platform is built on top of a relational schema designed to grow without
rework:

| Entity | Responsibility |
| --- | --- |
| `companies` | Client businesses using the platform |
| `users` | Platform users, scoped to a company, with role-based access |
| `qr_codes` | Each QR code created by a company |
| `qr_blocks` | The buttons shown when a code is scanned |
| `templates` | Reusable presets to speed up code creation |
| `files` | Centralised storage of uploaded assets |
| `analytics` | A record of every scan |
| `subscriptions` | Plans and limits per company |

A company owns many users, QR codes, files and subscriptions. A QR code belongs
to one company and owns many blocks and analytics entries.

## Getting started

### Prerequisites

- Node.js 20 or later
- A PostgreSQL database (a hosted instance such as Neon works out of the box)

### Installation

```bash
npm install
```

### Environment variables

Copy the example file and fill in your database connection strings:

```bash
cp .env.example .env
```

- `DATABASE_URL` — pooled connection used by the application at runtime.
- `DIRECT_URL` — direct connection used by Prisma to run migrations.

### Database

Apply the schema and generate the Prisma client:

```bash
npm run db:migrate
```

Optionally, populate the database with sample data:

```bash
npm run db:seed
```

### Running

```bash
npm run dev
```

The application is then available at `http://localhost:3000`.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the codebase |
| `npm run db:migrate` | Create and apply database migrations |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset the database |

## Project structure

```
prisma/          Database schema, migrations and seed
src/
  app/           Application routes and layout
  lib/           Shared utilities (Prisma client)
public/          Static assets
```

## Roadmap

- [x] Database schema and migrations
- [ ] Authentication and user management
- [ ] Company management
- [ ] QR code builder
- [ ] Public scan pages
- [ ] Scan analytics

## License

This project is released under the MIT License.
