export default $doctype<"Background Job Log">({
    job_id: {
        type: "Text",
        required: 1,
        unique: 1,
        in_list_view: 1,
        label: "Job ID"
    },
    background_path: {
        type: "Text",
        required: 1,
        in_list_view: 1,
        label: "Background Path"
    },
    requester: {
        type: "Reference",
        reference: "User",
        required: 0,
        in_list_view: 1,
        label: "Requester"
    },
    status: {
        type: "Select",
        options: "waiting\nactive\ncompleted\nfailed\ndelayed",
        required: 1,
        default: "waiting",
        in_list_view: 1,
        label: "Status"
    },
    attempts: {
        type: "Integer",
        default: "0",
        in_list_view: 1,
        label: "Attempts"
    },
    error: {
        type: "Text",
        label: "Error"
    },
    result: {
        type: "JSON",
        label: "Result"
    },
    started_at: {
        type: "DateTime",
        label: "Started At"
    },
    completed_at: {
        type: "DateTime",
        label: "Completed At"
    },
    created_at: {
        type: "DateTime",
        label: "Created At"
    }
}, {
    label: "Background Job Log",
    is_system_generated: 1,
    track_changes: 0
})
