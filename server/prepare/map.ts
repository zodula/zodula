import { loader } from "@/zodula/server/loader"
import path from "path"

function normalizeDoctypeName(name: string) {
    return name.toUpperCase().replace(/ /g, "_")
}

export function prepareMap() {
    const doctypes = loader.from("doctype").list()
    Bun.write(path.join(process.cwd(), ".zodula", "map", "doctype.ts"), `
    ${doctypes.map(doctype => `import ${normalizeDoctypeName(doctype.name)} from "${doctype.dir}";`).join("\n")}
    export const doctypeMap = {
        ${doctypes.map(doctype => `"${doctype.name}": ${normalizeDoctypeName(doctype.name)}`).join(",\n")}
    }
    `)
}