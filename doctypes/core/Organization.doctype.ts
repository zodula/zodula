export default $doctype<"zodula__Organization">({
    name: $f.Text({
        label: "Name",
        required: 1
    }),
}, {
    naming_series: "{{name}}",
    label: "Organization",
    is_global: 1,
})
.on("before_delete", async ({doc, old, input}) => {
    if(doc.owner !== (await $zodula.session.user()).id && !(await $zodula.session.roles()).includes("System Admin")){
        throw new Error("You are not allowed to delete this organization");
    }
});