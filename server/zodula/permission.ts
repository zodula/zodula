import { ErrorWithCode } from "../../error";
import { ZodulaSession } from "./session";

export class ZodulaPermission {

    static isOwnDoc(doc: Zodula.SelectDoctype<Zodula.DoctypeName>, userId: string) {
        return doc.owner === userId;
    }

    static async hasPermission(options: {
        tableName: Zodula.DoctypeName,
        userRoles: string[],
        isUserOwn: boolean,
        type: Omit<keyof Zodula.SelectDoctype<"zodula__Doctype Permission">, keyof Zodula.StandardFields>
    }) {
        return true;
    }

    static async validateUserAccess(
        tableName: Zodula.DoctypeName,
        permissionType: Omit<keyof Zodula.SelectDoctype<"zodula__Doctype Permission">, keyof Zodula.StandardFields>,
        doc?: any,
        bypass?: boolean,
    ) {
        const session = new ZodulaSession()
        const user = await session.user();
        const roles = await session.roles();

        if (!user && !bypass) {
            throw new ErrorWithCode("Unauthorized", {
                status: 401
            });
        }

        const hasRequiredPermission = await ZodulaPermission.hasPermission({
            tableName,
            userRoles: roles,
            isUserOwn: ZodulaPermission.isOwnDoc(doc, user.id),
            type: permissionType
        });
    }
}