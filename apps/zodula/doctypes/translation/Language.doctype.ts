export default $doctype({
    name: {
        type: "Text",
        label: "Name"
    },
    abbr: {
        type: "Text",
        label: "Abbreviation"
    },
    flag_emoji: {
        type: "Text",
        label: "Flag Emoji"
    }
}, {
    label: "Language",
    search_fields: "name\nabbr",
    naming_series: "{{abbr}}"
})