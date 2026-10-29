import DataPage from "../../components/DataPage";
import { LAB_STATUS, labColumns, labFields } from "../../config/schemas";

export default function LabQueue() {
  return <DataPage module="lab" title="Lab queue" single="lab request" createLabel="Walk-in test" empty="No lab requests yet."
    sub="Start a test, enter the result, then mark it completed so the doctor can see it." columns={labColumns} fields={labFields} statuses={LAB_STATUS}
    tabs={[{ key: "req", label: "Requested", filter: (r) => r.status === "requested" }, { key: "prog", label: "In progress", filter: (r) => r.status === "in_progress" },
      { key: "done", label: "Completed", filter: (r) => r.status === "completed" }]}
    rowActions={(r, { patch, edit }) => r.status === "requested" ? [{ label: "Start", onClick: () => patch(r, { status: "in_progress" }, "Test started.") }]
      : r.status === "in_progress" ? [{ label: "Enter result", onClick: () => edit(r) }, { label: "Complete", tone: "primary", onClick: () => patch(r, { status: "completed" }, "Result released to the doctor.") }] : []} />;
}
