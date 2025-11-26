import BXO from "bxo";
import path from "path";
import { zodula } from "../..";

export const extendPublic = () => {
  const bxo = new BXO();
  bxo.get("/public/*", async (ctx) => {
    const [app, ...rest] = ctx.params.wildcard.split("/");
    if (!app) {
      return ctx.json(
        {
          error: "App not found",
        },
        404
      );
    }
    const filePath = path.join(
      process.cwd(),
      "apps",
      app,
      "public",
      rest.join("/")
    );
    const fieldType = filePath.split(".").pop();
    if (fieldType === "js") {
      ctx.set.headers["Content-Type"] = "application/javascript";
      return Bun.file(filePath) as any;
    } else {
      return Bun.file(filePath) as any;
    }
  });
  // dist
  bxo.get("/dist/*", async (ctx) => {
    const [...rest] = ctx.params.wildcard.split("/");
    const filePath = path.join(
      process.cwd(),
      ".zodula",
      "dist",
      rest.join("/")
    );
    const fieldType = filePath.split(".").pop();
    if (fieldType === "js") {
      ctx.set.headers["Content-Type"] = "application/javascript";
    }
    return Bun.file(filePath) as any;
  });

  bxo.get("/favicon.ico", async (ctx) => {
    const filePath = await zodula
      .doctype("zodula__Global Setting")
      .get_file_url("zodula__Global Setting", "favicon")
      .catch(() => null);
    if (!filePath) {
      return Bun.file(
        path.join(process.cwd(), "apps", "zodula", "public", "favicon.ico")
      ) as any;
    }
    return Bun.file(filePath) as any;
  });
  return bxo;
};
