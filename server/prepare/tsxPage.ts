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
            <Routes>
                ${pages.map(page => `<Route path="${page.path}" element={<>${uiScripts.map(script => `<${script.importName} />`).join("\n")}<${page.importName} /></>} />`).join("\n")}
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
}

export const buildIndexJs = async () => {
    await Bun.build({
        entrypoints: [path.join(process.cwd(), ".zodula", "ui", "index.tsx")],
        outdir: path.join(process.cwd(), ".zodula", "dist"),
        plugins: [
            tailwindcss
        ]
    })
}