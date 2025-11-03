import { Database } from "@/zodula/server/database";
import { loader } from "@/zodula/server/loader";
import path from "path";
import tailwindcss from "bun-plugin-tailwind";

export async function prepareApp() {
    await loader.from("page").load()
    await loader.from("ui-script").load()
    const pages = loader.from("page").list()
    const shell = loader.from("page").getShell()
    const uiScripts = loader.from("ui-script").list()
    // write App.tsx
    Bun.write(path.join(process.cwd(), ".zodula", "ui", "App.tsx"), `
    import React from "react";
    import { Routes, Route, Link } from "@/zodula/ui/components/router";
    ${pages.map(page => `import ${page.importName} from "${page.importPath}";`).join("\n")}
    ${shell.map(shell => `import ${shell.importName} from "${shell.importPath}";`).join("\n")}
    ${uiScripts.map(script => `import ${script.importName} from "${script.importPath}";`).join("\n")}
    export default function App() {
    return(
        ${shell.length > 0 ? shell.map(shell => `<${shell.importName}>`).join("\n") : ""}
        ${uiScripts.map(script => `<${script.importName} />`).join("\n")}
            <Routes>
                ${pages.map(page => `<Route path="${page.path}" element={<${page.importName} />} />`).join("\n")}
            </Routes>
        ${shell.length > 0 ? shell.slice().reverse().map(shell => `</${shell.importName}>`).join("\n") : ""}
    )
    }
    `)
}

export async function prepareTsxPage() {
    const db = Database("main")
    // write index.tsx
    Bun.write(path.join(process.cwd(), ".zodula", "ui", "index.tsx"), `
    import React from "react";
    import { createRoot, hydrateRoot } from "react-dom/client";
    import { BrowserRouter } from "@/zodula/ui/components/router";
import App from "./App";

function start() {
//   const root = createRoot(document.getElementById("root")!);
//   root.render(<BrowserRouter><App /></BrowserRouter>);

hydrateRoot(document.getElementById("root")!, <BrowserRouter><App /></BrowserRouter>);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

    `)

    await prepareIndexHtml()
}

export const buildIndexJs = async () => {
    Bun.build({
        entrypoints: [path.join(process.cwd(), ".zodula", "ui", "index.tsx")],
        outdir: path.join(process.cwd(), ".zodula", "dist"),
        plugins: [
            tailwindcss
        ]
    })
}

export const prepareIndexHtml = async () => {
    const db = Database("main")
    const websiteSetting = await db.select().from("zodula__Global Setting" as Zodula.DoctypeName).where("id", "=", "zodula__Global Setting").first().catch(() => null) as Zodula.SelectDoctype<"zodula__Global Setting"> | null
    const faviconUrl = ["..", "..", ".zodula_data", "files", "zodula__Global Setting", "zodula__Global Setting", "favicon", websiteSetting?.favicon as string || ""].join("/")
    const description = websiteSetting?.description || "An open-source fullstack web framework for building modern web applications."
    Bun.write(path.join(process.cwd(), ".zodula", "ui", "index.html"), `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script type="module" src="index.tsx"></script>
        <title>${websiteSetting?.website_name || "Zodula"}</title>
        <meta name="description" content="${description}" />
        <link rel="icon" href="${websiteSetting?.favicon as string ? faviconUrl : "../../apps/zodula/public/favicon.ico"}" />
    </head>
    <body>
        <div id="root"></div>
    </body>
    </html>
    `)

    await buildIndexJs()
}