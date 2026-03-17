## Zodula Framework

**Zodula** is a Bun‑native, type‑safe framework for building data‑driven admin apps around **Doctypes** (typed schemas) instead of hand‑rolled CRUD code.

### Core ideas

- **Doctypes as source of truth**  
  You define business objects as Doctypes in `apps/*/doctypes/*`.  
  From these definitions Zodula generates:
  - SQLite schema and migrations
  - TypeScript types (via `FieldHelper` and Zod schemas)
  - REST APIs and OpenAPI docs
  - Admin UI forms, lists, and audit trail views

- **Standard fields & conventions**  
  Every document automatically gets standard fields like `id`, `doc_organization`, `owner`, `created_at`, `updated_at`, `doc_status`, etc.  
  These are shared on the client (`ClientFieldHelper.standardFields`) and server (`FieldHelper.doctypeToZod`) so validation, storage, and UI stay in sync.

- **Field plugins**  
  Server‑side field plugins (for `Text`, `Integer`, `Select`, `Reference`, `Reference Table`, `Extend`, `Vector`, `Signature`, and more) describe:
  - SQL type
  - TypeScript type
  - Zod validation schema  
  This keeps schema, runtime validation, and generated SDK all aligned.

- **Generated desk UI**  
  The core admin UI (e.g. `DocFormView`) reads Doctype + Field metadata and renders forms automatically:
  - Required and read‑only rules
  - Permission‑level field visibility
  - Reference tables, extend fields, and child rows
  - Form scripts (`executeFormScripts`) for custom behavior
  - Audit trail, status badges, actions, and connections

- **Type‑safe client**  
  On the frontend you use the bundled client:

  ```ts
  import { zodula, z } from "@zodula/zodula/client";

  // Fetch a document
  const user = await zodula.doc.get_doc("User", "USER_ID");

  // Create a document
  const created = await zodula.doc.create_doc("User", {
    email: "me@example.com",
    password: "secret",
  });
  ```

  Hooks in `apps/zodula/ui/hooks` (`useDocList`, `useDocAll`, `useForm`, etc.) are thin, focused helpers that keep UI code small and predictable.

### What this app (`apps/zodula`) provides

- **Core server helpers**
  - `FieldHelper` and field plugins for mapping Doctypes to SQL and Zod
  - Utilities for generating Zod schemas, filtering out relational/standard fields, etc.

- **Core client helpers**
  - `createZodulaClient`, `zodula`, and re‑exported `z` (Zod) for building typed queries and mutations
  - `ClientFieldHelper` with shared standard field metadata and permission helpers

- **Core UI**
  - Desk layout components (`NavbarLayout`, `SidebarLayout`)
  - Generic `Form` renderer, `FormActions`, audit trail, status badges
  - `DocFormView` which handles:
    - Loading docs and field metadata
    - Tracking dirty state and caching form data
    - Validating required fields (including reference tables and extend fields)
    - Running form scripts and handling `fetch_from` logic
    - Submitting, updating, cancelling, deleting, and duplicating docs

All higher‑level apps (for example `@zodula/zerp`) are built on top of this core.

### Quick start (project level)

Use the **Nailgun** CLI to bootstrap and run a project that includes this app.

- **Requirements**
  - Bun v1.2.x+
  - `nailgun` CLI (`bun install --global nailgun`)

- **Create project and install core**

```bash
nailgun create my-app --branch v0
cd my-app

nailgun install-app @zodula/zodula --branch v0
nailgun dev
```

Then open `http://localhost:3000` and work inside the `apps/` folder.

### Everyday workflow

- **Define / edit Doctypes** in `apps/*/doctypes/*`
- **Run migrations** to sync DB and generated types:

```bash
nailgun migrate
```

- **Develop UI** by composing:
  - server metadata (`Doctype`, `Field`)
  - client helpers (`zodula`, hooks, `ClientFieldHelper`)
  - shared desk components (forms, layouts, actions)

### API surface (high‑level)

- **REST**
  - `GET /api/resources/{Doctype}` – list documents
  - `GET /openapi` – OpenAPI spec and docs

- **Client SDK (typed)**
  - `zodula.doc.get_doc(doctype, id)`
  - `zodula.doc.create_doc(doctype, payload)`
  - `zodula.doc.update_doc(doctype, id, payload)`
  - `zodula.doc.delete_doc(doctype, id)`

### Stability

This is **v0** of Zodula. APIs and storage formats may change and can cause breaking changes or data loss. Use for development and testing only and always keep backups for real data.
