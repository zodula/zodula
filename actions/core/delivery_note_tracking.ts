import { z } from "bxo";

export default $action(async (ctx) => {
  const org = (ctx.query as { org?: string }).org;
  const delivery_note_id = (ctx.query as { delivery_note_id?: string }).delivery_note_id;
  if (!org || !delivery_note_id) {
    return ctx.json({ delivery_note: null, manifests: [], installation_notes: [], installation_percentage: 0 });
  }

  ctx.headers["x-organization"] = org;

  const deliveryOrder = await $zodula.doctype("Delivery Note" as any).get(delivery_note_id as any).bypass(true);
  if (!deliveryOrder?.id) {
    return ctx.json({ delivery_note: null, manifests: [], installation_notes: [], installation_percentage: 0 });
  }

  if ((deliveryOrder as any).doc_status !== "Submitted") {
    throw new Error("Delivery Note must be submitted to track installation.");
  }

  const itemsRes = await $zodula.doctype("Delivery Trip Item" as any)
    .select()
    .where("delivery_note", "=", delivery_note_id)
    .bypass(true)
    .limit(500);
  const items = itemsRes.docs || [];
  const manifestIds = [...new Set((items as { parentid?: string }[]).map((i) => i.parentid).filter(Boolean))] as string[];

  const manifests: Record<string, unknown>[] = [];
  for (const mid of manifestIds) {
    const m = await $zodula.doctype("Delivery Trip" as any).get(mid).bypass(true).fields([
      "id",
      "posting_date",
      "posting_time",
      "source_warehouse",
      "target_warehouse",
      "driver_name",
      "vehicle_plate",
      "transporter_name",
    ] as any);
    if (m) manifests.push(m as Record<string, unknown>);
  }

  manifests.sort((a, b) => {
    const dA = (a.posting_date as string) || "";
    const dB = (b.posting_date as string) || "";
    const tA = (a.posting_time as string) || "";
    const tB = (b.posting_time as string) || "";
    return dA !== dB ? dA.localeCompare(dB) : tA.localeCompare(tB);
  });

  // Installation Notes and percentage
  const installationRes = await $zodula
    .doctype("Installation Note" as any)
    .select()
    .where("delivery_note", "=", delivery_note_id)
    .bypass(true)
    .limit(100);

  const installationNotesRaw = installationRes.docs || [];
  const installation_notes: Record<string, unknown>[] = [];

  for (const note of installationNotesRaw as any[]) {
    if (!note?.id) continue;
    const proofBase64 = await $zodula.utils.get_image_base64({
      org,
      doctype: "Installation Note" as any,
      docId: String(note.id),
      fieldName: "installation_proof",
      bypass: true,
      width: 512,
    });
    installation_notes.push({
      id: note.id,
      installation_date: note.installation_date,
      installation_time: note.installation_time,
      installation_proof: proofBase64,
    });
  }

  const installation_percentage =
    typeof (deliveryOrder as any).installation_percentage === "number"
      ? (deliveryOrder as any).installation_percentage
      : parseFloat(String((deliveryOrder as any).installation_percentage ?? 0)) || 0;

  return ctx.json({
    delivery_note: deliveryOrder as Record<string, unknown>,
    manifests,
    installation_notes,
    installation_percentage,
  });
}, {
  method: "GET",
  query: z.object({
    org: z.string().min(1),
    delivery_note_id: z.string().min(1),
  }),
  response: {
    200: z.object({
      delivery_note: z.any().nullable(),
      manifests: z.array(z.any()),
      installation_notes: z.array(z.any()),
      installation_percentage: z.number(),
    }),
  },
});
