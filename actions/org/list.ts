import { z } from "bxo"

export default $action(async (ctx) => {
    const user = await $zodula.session.user()
    if (!user) {
        return ctx.json({
            data: []
        }, 403)
    }

    const singleOrg = await $zodula.doctype("Organization").get("Organization").bypass(true)
    const data = singleOrg ? [singleOrg] : []

    return ctx.json({
        data
    })
}, {
})