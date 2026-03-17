import { z } from "bxo";

function getServerTimezone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) return resolved;
  } catch {
    /* ignore */
  }
  if (typeof process !== "undefined" && process.env?.TZ) return process.env.TZ;
  return "UTC";
}

export default $action(async (ctx) => {
  const timezone = getServerTimezone();
  return ctx.json({
    timezone,
    resetNote:
      "Daily limits reset at midnight; monthly limits reset on the 1st. All times are in server timezone.",
  });
}, {
  response: {
    200: z.object({
      timezone: z.string(),
      resetNote: z.string(),
    }),
  },
});
