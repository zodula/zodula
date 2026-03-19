// Bun test preload / shared test bootstrap.
// This project needs database schema + doctype metadata pre-defined in order
// for Reference fields and submit hooks to work.

process.env.NODE_ENV ??= "test";
// Make sure server-side helpers writing to `Database("main")` do not
// pollute your real `main.db`. This works because `Database("main")`
// is remapped in `apps/zodula/server/database/database.ts`.
process.env.ZODULA_DB_MAIN ??= "test";

let initPromise: Promise<void> | null = null;
let cleanupRegistered = false;

export async function initZodulaTest() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mod = await import("@/zodula/server/startup");
    await mod.startup();

    // Ensure schema tables exist for the "main" DB (runtime is hardcoded to main).
    const { SyncMigrator } = await import(
      "@/zodula/server/migrator/migrator.sync"
    );
    const { DatabaseHelper } = await import(
      "@/zodula/server/database/database"
    );
    // Start tests from a clean DB.
    DatabaseHelper.deleteDatabase("main");
    const migrator = new SyncMigrator();
    const diff = await migrator.compare("main", false);
    await migrator.apply("main", diff, false);

    // Create core metadata rows (Doctype, Field, Children, Relatives, etc.)
    const { applyPredefine } = await import(
      "@/zodula/commands/migrate/apply-predefine"
    );
    await applyPredefine();

    // Seed base fixtures like Roles/Workspace so permission checks can work.
    const { applyFixtures } = await import(
      "@/zodula/commands/migrate/apply-fixtures"
    );
    await applyFixtures();

    // Ensure minimal permissions for the role used in tests.
    // ZodulaSession defaults to role "Anonymous" when running without cookies.
    // Some doctype hooks (e.g. Payment Entry -> Sales Invoice payment_status)
    // perform normal `.update()` calls, which require doctype permissions.
    const ensureDoctypePermission = async (args: {
      doctype: Zodula.DoctypeName;
      role: string;
      canGet: 0 | 1;
      canSelect: 0 | 1;
      canUpdate: 0 | 1;
      canCreate?: 0 | 1;
      canDelete?: 0 | 1;
    }) => {
      const { doctype, role, canGet, canSelect, canUpdate, canCreate, canDelete } = args;

      const existing = await $zodula
        .doctype("Doctype Permission")
        .select()
        .bypass(true)
        .where("doctype", "=", doctype)
        .where("role", "=", role)
        .where("perm_level", "=", "0")
        .limit(10);

      if ((existing as any).docs?.length) {
        const docs = (existing as any).docs as Array<{ id: string }>;
        for (const doc of docs) {
          const fields: any = {
            perm_level: "0",
            can_get: String(canGet) as any,
            can_select: String(canSelect) as any,
            can_update: String(canUpdate) as any,
          };
          if (canCreate !== undefined) fields.can_create = String(canCreate) as any;
          if (canDelete !== undefined) fields.can_delete = String(canDelete) as any;

          await $zodula
            .doctype("Doctype Permission")
            .update(doc.id, {
              ...fields,
            } as any)
            .bypass(true);
        }
        return;
      }

      await $zodula
        .doctype("Doctype Permission")
        .insert({
          doctype,
          role,
          perm_level: "0",
          can_get: String(canGet) as any,
          can_select: String(canSelect) as any,
          can_update: String(canUpdate) as any,
          ...(canCreate !== undefined ? { can_create: String(canCreate) as any } : {}),
          ...(canDelete !== undefined ? { can_delete: String(canDelete) as any } : {}),
        } as any)
        .bypass(true);
    };

    await ensureDoctypePermission({
      doctype: "Sales Invoice",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 1,
    });

    await ensureDoctypePermission({
      doctype: "Payment Entry Reference",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 0,
    });

    await ensureDoctypePermission({
      doctype: "Payment Entry",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 0,
    });

    await ensureDoctypePermission({
      doctype: "Sales Invoice Item",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 1,
    });

    await ensureDoctypePermission({
      doctype: "Price",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 1,
    });

    // Payment Entry may insert/delete General Ledger rows, and the
    // General Ledger hooks update Account balances.
    await ensureDoctypePermission({
      doctype: "General Ledger",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 0,
      canCreate: 1,
      canDelete: 1,
    });

    await ensureDoctypePermission({
      doctype: "Account",
      role: "Anonymous",
      canGet: 1,
      canSelect: 1,
      canUpdate: 1,
    });

    // Cleanup after test process exits so we don't leave test DB artifacts around.
    // This deletes the *resolved* schema for `Database("main")` (we remap it to `test`).
    if (!cleanupRegistered && process.env.NODE_ENV === "test") {
      cleanupRegistered = true;
      const cleanup = () => {
        try {
          DatabaseHelper.deleteDatabase("main");
        } catch {
          // Best-effort cleanup; don't fail tests due to cleanup errors.
        }
      };

      process.on("exit", cleanup);
      process.on("SIGINT", () => {
        cleanup();
        process.exit(130);
      });
      process.on("SIGTERM", () => {
        cleanup();
        process.exit(143);
      });
    }
  })();

  return initPromise;
}

// Bun `--preload` runs before test files execute. By awaiting here, the
// globals like `$zodula` and the database schema are guaranteed to exist
// before any test imports execute.
await initZodulaTest();

