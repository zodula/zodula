import BXO from "bxo";
import { logger } from "../logger";

let installed = false;

/**
 * Keeps the Bun HTTP server alive when a route throws: BXO's dispatch awaits the
 * handler without a try/catch, so a rejected handler promise can crash the process.
 * Also logs stray unhandled rejections instead of exiting.
 */
export function installServerErrorHandling() {
  if (installed) return;
  installed = true;

  process.on("unhandledRejection", (reason: any) => {
    logger.error("Unhandled rejection:", reason?.message || reason);
  });

  process.on("uncaughtException", (error: any) => {
    logger.error("Uncaught exception:", error?.message || error);
  });

  const proto = BXO.prototype as any;
  const originalDispatch = proto.dispatch;
  if (typeof originalDispatch !== "function") return;

  proto.dispatch = async function (
    this: InstanceType<typeof BXO>,
    route: any,
    req: Request,
    pathname?: string,
  ) {
    try {
      return await originalDispatch.call(this, route, req, pathname);
    } catch (error) {
      const hooks = (this as any).onErrorHooks as
        | Array<(e: Error, req: Request) => Response | Promise<Response | void>>
        | undefined;
      if (hooks?.length) {
        for (const hook of hooks) {
          try {
            const res = await hook(error as Error, req);
            if (res instanceof Response) return res;
          } catch {
            /* ignore */
          }
        }
      }
      logger.error(error);
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
