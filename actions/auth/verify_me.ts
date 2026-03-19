import { z } from "bxo";

export default $action(async ctx => {
  const { password } = ctx.body;
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }
  const user = await $zodula.session.user().catch(() => null);
  if (!user?.id) {
    throw new Error("Not authenticated");
  }
  const userDoc = await $zodula.doctype("User").get(user.id as any).bypass(true).fields(["password"]).unsafe()
  if (!userDoc?.password) {
    throw new Error("User not found");
  }
  const valid = await Bun.password.verify(password, userDoc.password as string);
  if (!valid) {
    throw new Error("Invalid password");
  }
  return ctx.json({ ok: true });
}, {
  body: z.object({
    password: z.string(),
  }),
  response: {
    200: z.object({ ok: z.literal(true) }),
  },
});
