import DataPage from "../../components/DataPage";
import { APPT_STATUS, apptColumns } from "../../config/schemas";

export default function Appointments() {
  return <DataPage module="appointments" title="Appointments" single="appointment" readOnly empty="No appointments yet."
    sub="Bookings across the clinic (view only)." columns={apptColumns} statuses={APPT_STATUS} />;
}
