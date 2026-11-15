import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { LAB_STATUS, labColumns, labFields } from "../../config/schemas";

// The lab technician's queue. The radiologist uses the very same page for imaging requests (department "radiology"), so each sees only their own requests.
export default function LabQueue({ department = "lab" }) {
  const mine = (r) => (r.department || "lab") === department;
  const radio = department === "radiology";
  const word = radio ? "imaging request" : "lab request";
  return <DataPage docBuilder={DOCS.lab_report} module="lab" title={radio ? "Imaging queue" : "Lab queue"} single={word} createLabel={radio ? undefined : "Walk-in test"} empty={`No ${word}s yet.`}
    sub="Start the test, enter the result and your fee (it can be 0), then complete it so the doctor can see it." columns={labColumns} fields={labFields} statuses={LAB_STATUS}
    tabs={[{ key: "req", label: "Requested", filter: (r) => mine(r) && r.status === "requested" }, { key: "prog", label: "In progress", filter: (r) => mine(r) && r.status === "in_progress" },
      { key: "done", label: "Completed", filter: (r) => mine(r) && r.status === "completed" }]}
    rowActions={(r, { patch, edit }) => r.status === "requested" ? [{ label: "Start", onClick: () => patch(r, { status: "in_progress" }, "Test started.") }]
      : r.status === "in_progress" ? [{ label: "Enter result and fee", onClick: () => edit(r) },
        { label: "Complete", tone: "primary", onClick: () => (r.fee == null ? edit(r) : patch(r, { status: "completed" }, "Result released to the doctor.")) }] : []} />;
}
