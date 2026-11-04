import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { patientColumns, patientFields } from "../../config/schemas";

export default function Patients() {
  return <DataPage docBuilder={DOCS.patient_summary} module="patients" title="Patients" single="patient" createLabel="Register patient" empty="No patients yet."
    sub="Register new patients and update their details." columns={patientColumns} fields={patientFields} />;
}
