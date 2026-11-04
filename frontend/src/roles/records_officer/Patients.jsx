import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { patientColumns, patientFields } from "../../config/schemas";

export default function Patients() {
  return <DataPage docBuilder={DOCS.patient_summary} module="patients" title="Patient register" single="patient" createLabel="Add patient" empty="No patients on record yet."
    sub="Keep the patient register complete and correct." columns={patientColumns} fields={patientFields} />;
}
