import DataPage from "../../components/DataPage";
import { APPT_STATUS, apptColumns, apptFields } from "../../config/schemas";

export default function Appointments() {
  return <DataPage module="appointments" title="My appointments" single="appointment" empty="No appointments yet."
    sub="Patients booked to see you. Switch to Everyone for the whole clinic."
    columns={apptColumns} fields={apptFields} statuses={APPT_STATUS}
    tabs={[{ key: "mine", label: "Mine", filter: (r, u) => r.doctor_name === u.full_name }, { key: "all", label: "Everyone", filter: () => true }]}
    rowActions={(r, { patch }) => ["scheduled", "checked_in"].includes(r.status) ? [{ label: "Complete", tone: "primary", onClick: () => patch(r, { status: "completed" }, "Appointment completed.") }] : []} />;
}
