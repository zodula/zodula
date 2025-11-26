import { ErrorWithCode } from "../../error"
import { ctxContext } from "../async-context"
import { Database } from "../database/database"

export class ZodulaSession {
    private getSystemUser() {
        return {
            name: "System",
            email: "system@example.com",
            password: "password",
            is_active: 1,
            id: "",
            created_at: "2021-01-01",
            updated_at: "2021-01-01",
            created_by: "1",
            updated_by: "1",
            doc_status: 1,
            owner: "1",
        } satisfies Zodula.SelectDoctype<"zodula__User">
    }

    async user(bypass?: boolean) {
        const db = Database("main")
        const ctx = ctxContext.getStore()?.ctx
        const sid = ctx?.cookies?.zodula_sid
        const apiKey = ctx?.headers?.["x-api-key"]
        if (!sid) {
            if (bypass) {
                return this.getSystemUser()
            }
            throw new ErrorWithCode("Unauthorized", {
                status: 401
            });
        }
        const session = await db.select("*").from("zodula__Session" as Zodula.DoctypeName).where("id", "=", sid)
        .where("expires_at", ">", new Date().toISOString())
        .first() as Zodula.SelectDoctype<"zodula__Session">
        if (!session) {
            if (bypass) {
                return this.getSystemUser()
            }
            throw new ErrorWithCode("Unauthorized", {
                status: 401
            });
        }
        const user = await db.select("*").from("zodula__User" as Zodula.DoctypeName).where("id", "=", session.user).first() as Zodula.SelectDoctype<"zodula__User">
        
        if (!user) {
            if (bypass) {
                return this.getSystemUser()
            }
            throw new ErrorWithCode("Unauthorized", {
                status: 401
            });
        }
        return user
    }

    async roles(bypass?: boolean) {
        const db = Database("main")
        const user = await this.user(true)

        const roles = await db.select("*").from("zodula__User Role").where("user", "=", user.id).execute()
        const _roles = roles.map((role) => role.role)
        if (user.id !== "" && user.id !== null && user.id !== undefined) {
            _roles.indexOf("Authenticated") === -1 && _roles.push("Authenticated")
            _roles.indexOf("Anonymous") === -1 && _roles.push("Anonymous")
        } else {
            _roles.indexOf("Anonymous") === -1 && _roles.push("Anonymous")
        }
        return _roles
    }

    async isAuthenticated(bypass?: boolean) {
        const user = await this.user(true)
        return user.id !== "" && user.id !== null && user.id !== undefined
    }

    async hasRoles(roles: string[]) {
        const userRoles = await this.roles(true)
        return roles.some((role) => userRoles.includes(role))
    }
}