import DataPage from "../../components/DataPage";
import { patientColumns, patientFields } from "../../config/schemas";

export default function Patients() {
  return <DataPage module="patients" title="Patient registration" single="patient" createLabel="Register patient" empty="No patients yet. Register the first patient."
    sub="Register patients and keep their contact details up to date." columns={patientColumns} fields={patientFields} />;
}
