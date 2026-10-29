import DataPage from "../../components/DataPage";
import { labResultColumns } from "../../config/schemas";

export default function LabResults() {
  return <DataPage module="lab" title="Lab results" single="lab result" readOnly empty="No lab requests yet."
    sub="Results for your patients." columns={labResultColumns}
    tabs={[{ key: "done", label: "Results ready", filter: (r) => r.status === "completed" }, { key: "open", label: "Waiting", filter: (r) => r.status !== "completed" }]} />;
}
