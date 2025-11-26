export default $doctype<"zodula__Audit Trail">(
  {
    doctype: {
      type: "Reference",
      reference: "zodula__Doctype",
      required: 1,
    },
    doctype_id: {
      type: "Virtual Reference",
      reference: "{{doctype}}",
      required: 1,
    },
    action: {
      type: "Select",
      options: "Insert\nUpdate\nDelete\nRename\nSubmit\nCancel\nComment",
      required: 1,
    },
    old_value: {
      type: "JSON",
      label: "Old Value",
    },
    new_value: {
      type: "JSON",
      label: "New Value",
    },
    by_name: {
      type: "Text",
      label: "By Name",
    },
    comment: {
      type: "Text",
      label: "Comment",
    },
  },
  {
    label: "Audit Trail",
    tabs: JSON.stringify([
      {
        label: "Main",
        layout: [
          { type: "section", value: "Doctype", align: "left" },
          [
            { type: "field", value: "doctype", align: "left" },
            { type: "field", value: "doctype_id", align: "left" },
          ],
          [
            { type: "empty", value: "", align: "left" },
            { type: "field", value: "action", align: "left" },
          ],
          [
            { type: "field", value: "old_value", align: "left" },
            { type: "field", value: "new_value", align: "left" },
          ],
          [
            { type: "field", value: "comment", align: "left" },
            { type: "empty", value: "", align: "left" },
          ],
        ],
      },
    ]),
  }
).on("before_insert", async ({ doc }) => {
  const doctype = await $zodula.doctype("zodula__Doctype").get(doc.doctype);
  if (!doctype.comments_enabled && doc.action === "Comment") {
    throw new Error("Comments are not enabled for this doctype");
  }
});
