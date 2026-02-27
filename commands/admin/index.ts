import { logger } from "@/zodula/server/logger"
import { startup } from "@/zodula/server/startup"
import { Command } from "nailgun"

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
                const _roles = roles.split(",")
                const exists = await $zodula.doctype("User").select().where("email", "=", email).bypass(true)
                if (exists.count > 0) {
                    throw "User already exists"
                } else {
                    const user = await $zodula.doctype("User").insert({
                        email,
                        password,
                        is_active: 1,
                        is_confirmed_email: 1
                    }).bypass(true)
                    for (const role of _roles) {
                        await $zodula.doctype("User Role").insert({
                            user: user.id,
                            role
                        }).bypass(true)
                    }
                }
                process.exit(0)
            } catch (error) {
                logger.error(error)
                process.exit(1)
            }
        }))
