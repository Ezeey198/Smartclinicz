import DataPage from "../../components/DataPage";
import { patientColumns } from "../../config/schemas";

export default function Patients() {
  return <DataPage module="patients" title="Patients" single="patient" readOnly empty="No patients yet." sub="Look up patient details." columns={patientColumns} />;
}
