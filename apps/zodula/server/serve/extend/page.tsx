import BXO from "bxo";
import { loader } from "../../loader";
import { Database } from "../../database/database";
import { ctxContext, dbcontext } from "../../async-context";
import { logger } from "../../logger";
import { renderToReadableStream } from "react-dom/server";
import { StaticRouter } from "@/zodula/ui/components/router";
import type { Metadata } from "@/zodula/ui/components/metadata";
import path from "path";

function getPublicEnvs() {
  const publicEnvs = {} as any;
  for (const env of Object.keys(process.env)) {
    if (env.startsWith("ZODULA_PUBLIC_")) {
      publicEnvs[env] = process.env[env];
    }
  }
  return publicEnvs;
}

async function mergeShellMetadata(
  pageMetadata: Metadata,
  shells: any[],
  ctx: any
): Promise<Metadata> {
  let mergedMetadata = { ...pageMetadata };

  for (const shell of shells) {
    if (shell.generateMetadata) {
      const shellMetadata = await shell.generateMetadata(ctx);
      mergedMetadata = { ...mergedMetadata, ...shellMetadata };
    }
  }

  return mergedMetadata;
}

const AppShell = ({
  pathname,
  metadata,
  App,
}: {
  pathname: string;
  metadata: Metadata | undefined;
  App: any;
}) => {
  const publicEnvs = getPublicEnvs();
  return (
    <html>
      <body>
        <div id="root">
          <StaticRouter location={pathname}>
            <App />
          </StaticRouter>
        </div>
      </body>
      <head>
        {metadata && (
          <>
            <title>{metadata.title || "Zodula Framework"}</title>
            <link rel="icon" href={"/favicon.ico"} />
            <meta name="description" content={metadata.description} />

            {/* Render structured links */}
            {metadata.links?.map((link, index) => {
              const { rel, href, ...rest } = link;
              return <link key={index} rel={rel} href={href} {...rest} />;
            })}

            {/* Render structured scripts */}
            {metadata.scripts?.map((script, index) => {
              const { src, type, async, defer, ...rest } = script;
              return (
                <script
                  key={index}
                  src={script.src}
                  type={script.type}
                  async={script.async}
                  defer={script.defer}
                  {...rest}
                />
              );
            })}

            {/* Render structured styles */}
            {metadata.styles?.map((style, index) => {
              const { href, ...rest } = style;
              return (
                <link key={index} rel="stylesheet" href={href} {...rest} />
              );
            })}

            {/* Render fonts with preload and @font-face */}
            {metadata.fonts?.map((font, index) => {
              const { family, src, weight, style, display, ...rest } = font;
              return (
                <link
                  key={`font-preload-${index}`}
                  rel="preload"
                  href={src}
                  as="font"
                  type="font/ttf"
                  crossOrigin="anonymous"
                />
              );
            })}

            {metadata.fonts?.map((font, index) => {
              const { family, src, weight, style, display, ...rest } = font;
              return (
                <style key={`font-face-${index}`}>
                  {`@font-face {
                            font-family: '${family}';
                            src: url('${src}');
                            font-weight: ${weight || "normal"};
                            font-style: ${style || "normal"};
                            font-display: ${display || "swap"};
                        }`}
                </style>
              );
            })}

            {/* Render structured metas */}
            {metadata.metas?.map((meta, index) => {
              const { property, content, ...rest } = meta;
              return (
                <meta
                  key={index}
                  property={property}
                  content={content}
                  {...rest}
                />
              );
            })}

            {/* Render generic key-value pairs (excluding structured fields) */}
            {Object.entries(metadata).map(([key, value]) => {
              if (
                [
                  "title",
                  "description",
                  "links",
                  "scripts",
                  "styles",
                  "fonts",
                  "metas",
                ].includes(key)
              ) {
                return null;
              }
              return <meta key={key} name={key} content={value} />;
            })}
          </>
        )}
        <link rel="stylesheet" href="/dist/index.css"></link>
      </head>
      <script>{`
            window.process = window.process || {}
            window.process.env = ${JSON.stringify(publicEnvs)}
        `}</script>
    </html>
  );
};

export const extendPage = async () => {
  const server = new BXO();
  const pages = loader.from("page").list();
  const shells = loader.from("page").getShell();
  server.get("/", async (ctx) => {
    const db = Database("main");
    ctxContext.enterWith({
      ctx: ctx as any,
    });
    dbcontext.enterWith({
      trx: db,
    });
    const websiteSetting = (await db
      .select()
      .from("zodula__Global Setting" as Zodula.DoctypeName)
      .where("id", "=", "zodula__Global Setting")
      .first()
      .catch(
        () => null
      )) as Zodula.SelectDoctype<"zodula__Global Setting"> | null;
    const homepage = websiteSetting?.homepage;
    if (!!homepage && homepage !== "/") {
      return ctx.redirect(homepage);
    }
    logger.info(`Serving page /`);
    let pageMetadata =
      (await pages
        .find((page) => page.path === "/")
        ?.generateMetadata?.(ctx)) || ({} as Metadata);
    let metadata = await mergeShellMetadata(pageMetadata, shells, ctx);
    const websiteName = websiteSetting?.website_name || "Zodula Admin";
    metadata["website-name"] = websiteName;
    const AppPath = `${path.join(process.cwd(), ".zodula", "ui", "App.tsx")}`;
    const App = (await import(AppPath)).default;
    const html = await renderToReadableStream(
      <AppShell pathname="/" metadata={metadata} App={App} />,
      {
        bootstrapModules: ["/dist/index.js"],
      }
    );
    return html as any;
  });

  for (const page of pages) {
    server.get(`${page.path}`, async (ctx) => {
      logger.info(`Serving page ${page.path}`);
      const AppPath = `${path.join(process.cwd(), ".zodula", "ui", "App.tsx")}`;
      const App = (await import(AppPath)).default;
      const db = Database("main");
      ctxContext.enterWith({
        ctx: ctx as any,
      });
      dbcontext.enterWith({
        trx: db,
      });
      const websiteSetting = (await db
        .select()
        .from("zodula__Global Setting" as Zodula.DoctypeName)
        .where("id", "=", "zodula__Global Setting")
        .first()
        .catch(
          () => null
        )) as Zodula.SelectDoctype<"zodula__Global Setting"> | null;
      const pathname = new URL(ctx.request.url).pathname;
      let pageMetadata =
        (await page?.generateMetadata?.(ctx)) || ({} as Metadata);
      let metadata = await mergeShellMetadata(pageMetadata, shells, ctx);
      const websiteName = websiteSetting?.website_name || "Zodula Admin";
      metadata["website-name"] = websiteName;
      const html = await renderToReadableStream(
        <AppShell pathname={pathname} metadata={metadata} App={App} />,
        {
          bootstrapModules: ["/dist/index.js"],
        }
      );
      return html as any;
    });
  }
  return server;
};
