import DataPage from "../../components/DataPage";
import { RX_STATUS, rxColumns } from "../../config/schemas";

export default function Requests() {
  return <DataPage module="pharmacy" title="Dispensing requests" single="prescription" readOnly empty="No prescriptions yet."
    sub="Prescriptions the pharmacy is working through, so you can keep drugs in stock." columns={rxColumns} statuses={RX_STATUS} />;
}
