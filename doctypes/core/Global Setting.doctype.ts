import { prepareIndexHtml, prepareTsxPage } from "@/zodula/server/prepare/tsxPage"

export default $doctype({
    website_name: {
        type: "Text",
        label: "Website Name"
    },
    homepage: {
        type: "Text",
        label: "Homepage"
    },
    logo: {
        type: "File",
        label: "Logo",
        accept: "image/*"
    },
    favicon: {
        type: "File",
        label: "Favicon",
        accept: "image/*"
    },
    description: {
        type: "Text",
        label: "Description"
    },
    currency_symbol: {
        type: "Reference",
        reference: "zodula__Currency",
        label: "Currency Symbol"
    }
}, {
    label: "Global Setting",
    is_single: 1
}).on("after_save", async (doc) => {
    await prepareIndexHtml()
})