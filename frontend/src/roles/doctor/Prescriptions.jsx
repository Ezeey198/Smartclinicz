import DataPage from "../../components/DataPage";
import { RX_STATUS, rxColumns, rxPrescribeFields } from "../../config/schemas";

export default function Prescriptions() {
  return <DataPage module="pharmacy" title="Prescriptions" single="prescription" createLabel="New prescription" empty="No prescriptions yet."
    sub="Prescribe drugs. The pharmacist sees them in their queue." columns={rxColumns} fields={rxPrescribeFields} statuses={RX_STATUS} />;
}
