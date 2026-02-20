import { z } from "bxo"

export default $action(async (ctx) => {
    const user = await $zodula.session.user()
    if (!user) {
        return ctx.json({
            data: []
        }, 403)
    }
    const userRoles = await $zodula.session.roles()
    const organizationsOwn = await $zodula.doctype("Organization").select().where("owner", "=", user.id).bypass(true)
    const systemOrg = await $zodula.doctype("Organization").select().where("id", "=", "System Panel").bypass(true)
    const organizationsUserRoles = await $zodula.doctype("Organization Role").select().where("userId", "=", user.id).bypass(true)

    const organizationsUser = await $zodula.doctype("Organization").select().where("id", "IN", organizationsUserRoles?.docs?.map((doc) => doc.organizationId)).bypass(true)
    const data = [...organizationsOwn?.docs, ...organizationsUser?.docs]
    if(userRoles.includes("System Admin")) {
        data.push(systemOrg?.docs[0]!)
    }

    return ctx.json({
        data
    })
}, {
})