import DataPage from "../../components/DataPage";
import { labRequestFields, labResultColumns } from "../../config/schemas";

export default function LabRequests() {
  return <DataPage module="lab" title="Lab requests" single="lab request" createLabel="Request a test" empty="No lab requests yet."
    sub="Order tests and read results as the lab completes them." columns={labResultColumns} fields={labRequestFields}
    tabs={[{ key: "open", label: "Waiting", filter: (r) => r.status !== "completed" }, { key: "done", label: "Results ready", filter: (r) => r.status === "completed" }]} />;
}
