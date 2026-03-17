import { z } from "@/zodula/client"

export default $action(async (ctx) => {
    const { doctype, id } = ctx.body
    const connections = await $zodula.utils.getDoctypeConnections(doctype as any, id)
    const result = connections?.filter((connection) => {
        if (connection?.field?.includes(".")) {
            const [tableName, fieldName] = connection?.field?.split(".")
            return !$zodula.utils.isStandardField(fieldName as string)
        }
        return !$zodula.utils.isStandardField(connection?.field as string)
    })
    return ctx.json({
        connections: result
    })
}, {
    body: z.object({
        doctype: z.string(),
        id: z.string()
    })
})