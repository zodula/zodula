import { ErrorWithCode } from "../../error";
import { ctxContext } from "../async-context";
import { Database } from "../database/database";

export class ZodulaSession {
  private getSystemUser() {
    return {
      name: "System Panel",
      email: "system@example.com",
      password: "password",
      is_active: 1,
      id: "",
      created_at: "2021-01-01",
      updated_at: "2021-01-01",
      created_by: "1",
      updated_by: "1",
      doc_status: "Submitted",
      owner: "1",
      organization: "System Panel",
    } satisfies Zodula.SelectDoctype<"User">;
  }

  async organizations(bypass?: boolean) {
    const db = Database("main");
    const user = await this.user(true);
    const organizationsOwner = (await db
      .select("*")
      .from("Organization")
      .where("owner", "=", user.id)
      .execute()) as Zodula.SelectDoctype<"Organization">[];
    const organizationsUser = (await db
      .select("*")
      .from("Organization Role")
      .where("user", "=", user.id)
      .execute()) as Zodula.SelectDoctype<"Organization Role">[];
    return [
      ...organizationsOwner?.map((organization) => organization.id),
      ...organizationsUser.map((organization) => organization.organizationId),
    ];
  }

  async organizationRoles(organization?: string, bypass?: boolean) {
    const db = Database("main");
    const user = await this.user(true);
    const org = organization || (await this.organization(true));
    if (!org) {
      return [];
    }
    const organizationRoles = await db
      .select("*")
      .from("Organization Role")
      .where("userId", "=", user.id)
      .where("organizationId", "=", org)
      .execute();
      
    return organizationRoles.map(
      (organizationRole) => organizationRole.roleId
    );
  }

  async organization(bypass?: boolean) {
    const ctx = ctxContext.getStore()?.ctx;
    const headers = ctx?.headers;
    if (!headers) {
      return null;
    }
    const organization_id = headers?.["x-organization"];
    if (!organization_id) {
      return null;
    }
    const db = Database("main");
    const organizationRoles = (await db
      .select("*")
      .from("Organization Role")
      .where("organization", "=", organization_id)
      .execute()) as Zodula.SelectDoctype<"Organization Role">[];
    const organizationOwner = (await db
      .select("*")
      .from("Organization")
      .where("id", "=", organization_id)
      .execute()) as Zodula.SelectDoctype<"Organization">[];

    if (organizationOwner.length > 0 || organizationRoles.length > 0) {
      return organization_id;
    }
    return null;
  }

  async user(bypass?: boolean) {
    const db = Database("main");
    const ctx = ctxContext.getStore()?.ctx;
    const sid = ctx?.cookies?.zodula_sid;
    const apiKey = ctx?.headers?.["x-api-key"];
    if (!sid) {
      if (bypass) {
        return this.getSystemUser();
      }
      throw new ErrorWithCode("Unauthorized", {
        status: 401,
      });
    }
    const session = (await db
      .select("*")
      .from("Session" as Zodula.DoctypeName)
      .where("id", "=", sid)
      .where("expires_at", ">", new Date().toISOString())
      .first()) as Zodula.SelectDoctype<"Session">;
    if (!session) {
      if (bypass) {
        return this.getSystemUser();
      }
      throw new ErrorWithCode("Unauthorized", {
        status: 401,
      });
    }
    const user = (await db
      .select("*")
      .from("User" as Zodula.DoctypeName)
      .where("id", "=", session.user)
      .first()) as Zodula.SelectDoctype<"User">;

    if (!user) {
      if (bypass) {
        return this.getSystemUser();
      }
      throw new ErrorWithCode("Unauthorized", {
        status: 401,
      });
    }
    return user;
  }

  async roles(organization?: string | null, bypass?: boolean) {
    const db = Database("main");
    const user = await this.user(true);
    const org = organization ?? (await this.organization(true));
    const organizationRoles = await this.organizationRoles(org ?? undefined, true);
    const organizationDoc = await $zodula.doctype("Organization").get(org ?? "").bypass()

    const roles = await db
      .select("*")
      .from("User Role")
      .where("user", "=", user.id)
      .execute();
    const _roles = roles.map((role) => role.role);
    if (user.id !== "" && user.id !== null && user.id !== undefined) {
      _roles.indexOf("Authenticated") === -1 && _roles.push("Authenticated");
      _roles.indexOf("Anonymous") === -1 && _roles.push("Anonymous");
    } else {
      _roles.indexOf("Anonymous") === -1 && _roles.push("Anonymous");
    }
    if(organizationDoc?.owner === user.id) {
      _roles.push("Organization Owner");
    }
    return [..._roles, ...organizationRoles];
  }

  async isAuthenticated(bypass?: boolean) {
    const user = await this.user(true);
    return user.id !== "" && user.id !== null && user.id !== undefined;
  }

  async hasRoles(roles: string[]) {
    const userRoles = await this.roles(undefined, true);
    return roles.some((role) => userRoles.includes(role));
  }
}
