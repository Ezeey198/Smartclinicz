import DataPage from "../../components/DataPage";
import { vitalsColumns, vitalsFields } from "../../config/schemas";

export default function Triage() {
  return <DataPage module="visits" title="Triage and vitals" single="vitals record" createLabel="Record vitals" empty="No vital signs recorded yet."
    sub="Record temperature, blood pressure, pulse, weight and complaints before the doctor sees the patient." columns={vitalsColumns} fields={vitalsFields} />;
}
