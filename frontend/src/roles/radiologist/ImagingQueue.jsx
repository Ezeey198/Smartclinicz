import DataPage from "../../components/DataPage";
import { IMG_STATUS, imagingColumns, imagingFields } from "../../config/schemas";

export default function ImagingQueue() {
  return <DataPage module="imaging" title="Imaging queue" single="imaging request" createLabel="Walk-in exam" empty="No imaging requests yet."
    sub="Start an examination, write the report, then release it to the doctor." columns={imagingColumns} fields={imagingFields} statuses={IMG_STATUS}
    tabs={[{ key: "req", label: "Requested", filter: (r) => r.status === "requested" }, { key: "prog", label: "In progress", filter: (r) => r.status === "in_progress" },
      { key: "done", label: "Reported", filter: (r) => r.status === "reported" }]}
    rowActions={(r, { patch, edit }) => r.status === "requested" ? [{ label: "Start", onClick: () => patch(r, { status: "in_progress" }, "Examination started.") }]
      : r.status === "in_progress" ? [{ label: "Write report", onClick: () => edit(r) }, { label: "Release", tone: "primary", onClick: () => patch(r, { status: "reported" }, "Report released.") }] : []} />;
}
