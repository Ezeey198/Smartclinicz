import DataPage from "../../components/DataPage";
import { visitColumns, visitFields } from "../../config/schemas";

export default function Consultations() {
  return <DataPage module="visits" title="Consultations" single="consultation" createLabel="New consultation" empty="No consultations recorded yet."
    sub="Vital signs, complaints, diagnosis and treatment notes." columns={visitColumns} fields={visitFields} />;
}
