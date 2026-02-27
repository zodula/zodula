import { z } from "bxo";

export default $action(async (ctx) => {
    const { host, port, secure, user, password } = ctx.body;

    if (!host || !port) {
        throw new Error("Host and port are required");
    }

    const portNum = typeof port === "number" ? port : parseInt(String(port), 10);
    if (isNaN(portNum)) {
        throw new Error("Invalid port");
    }

    await $zodula.email.testConnection({
        host: String(host),
        port: portNum,
        secure: secure === 1 || secure === "1",
        user: user ? String(user) : undefined,
        pass: password ? String(password) : undefined,
    });

    return ctx.json({ success: true, message: "Connection successful" });
}, {
    body: z.object({
        host: z.string().min(1, "Host is required"),
        port: z.union([z.number(), z.string().transform((v) => parseInt(String(v), 10))]),
        secure: z.union([z.boolean(), z.literal(0), z.literal(1), z.string()]).optional(),
        user: z.string().optional(),
        password: z.string().optional(),
    }),
    response: {
        200: z.object({
            success: z.literal(true),
            message: z.string(),
        }),
    },
});
