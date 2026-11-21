import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { visitColumns, visitFields } from "../../config/schemas";

export default function Consultations() {
  return <DataPage docBuilder={DOCS.consultation} module="visits" title="Consultations" single="consultation" createLabel="New consultation" empty="No consultations recorded yet."
    sub="Vital signs, complaints, diagnosis and treatment notes." columns={visitColumns} fields={visitFields} />;
}
