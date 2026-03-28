import { logger } from "@/zodula/server/logger"
import { startup } from "@/zodula/server/startup"
import { Command } from "nailgun"

async function insertUser(email: string, password: string, rolesCsv: string) {
    const _roles = rolesCsv.split(",") as string[]
    return $zodula.doctype("User").insert({
        email,
        password,
        is_active: 1,
        is_confirmed_email: 1,
        owner: email,
        roles: _roles?.map((role) => ({
            id: "temp-id",
            role: role.trim(),
            created_at: $zodula.date.today(),
            updated_at: $zodula.date.today(),
            doc_status: "Draft",
        }))
    }).bypass(true)
}

export default new Command("admin")
    .description("Admin commands")
    .addCommand(new Command("create-user")
        .description("Create a user")
        .requiredOption("-e, --email <email>", "Enter the email of the user")
        .requiredOption("-p, --password <password>", "Enter the password of the user")
        .requiredOption("-r, --roles <roles>", "Enter the roles of the user")
        .action(async (options) => {
            try {
                await startup()
                const { email, password, roles } = options
                const exists = await $zodula.doctype("User").select().where("email", "=", email).bypass(true)
                if (exists.count > 0) {
                    throw "User already exists"
                }
                await insertUser(email, password, roles)
                process.exit(0)
            } catch (error) {
                logger.error(error)
                process.exit(1)
            }
        }))
    .addCommand(new Command("bootstrap-admin")
        .description("Create a default admin user only when the User table is empty (e.g. Docker first run)")
        .option("-e, --email <email>", "Email", "admin@example.com")
        .option("-p, --password <password>", "Password", "admin")
        .option("-r, --roles <roles>", "Comma-separated roles", "System Admin")
        .action(async (options) => {
            try {
                await startup()
                const { email, password, roles } = options
                const { count } = await $zodula.doctype("User").select().bypass(true)
                if (count > 0) {
                    logger.info("Users already exist; skipping bootstrap admin")
                    process.exit(0)
                    return
                }
                await insertUser(email, password, roles)
                logger.success(`Bootstrap admin created: ${email}`)
                process.exit(0)
            } catch (error) {
                logger.error(error)
                process.exit(1)
            }
        }))
