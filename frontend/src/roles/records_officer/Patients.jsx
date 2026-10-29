import DataPage from "../../components/DataPage";
import { patientColumns, patientFields } from "../../config/schemas";

export default function Patients() {
  return <DataPage module="patients" title="Patient register" single="patient" createLabel="Add patient" empty="No patients on record yet."
    sub="Keep the patient register complete and correct." columns={patientColumns} fields={patientFields} />;
}
