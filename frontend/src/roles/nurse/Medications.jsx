import DataPage from "../../components/DataPage";
import { RX_STATUS, rxColumns } from "../../config/schemas";

export default function Medications() {
  return <DataPage module="pharmacy" title="Medications" single="prescription" readOnly empty="No prescriptions yet."
    sub="Prescriptions for your patients and whether they were dispensed." columns={rxColumns} statuses={RX_STATUS} />;
}
