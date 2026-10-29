import DataPage from "../../components/DataPage";
import { APPT_STATUS, apptColumns, apptFields } from "../../config/schemas";

export default function Appointments() {
  return <DataPage module="appointments" title="Appointments" single="appointment" createLabel="Book appointment" empty="No appointments yet. Book the first one."
    sub="Book, check in and cancel appointments." columns={apptColumns} fields={apptFields} statuses={APPT_STATUS}
    tabs={[{ key: "up", label: "Upcoming", filter: (r) => ["scheduled", "checked_in"].includes(r.status) }, { key: "all", label: "All", filter: () => true }]}
    rowActions={(r, { patch }) => r.status === "scheduled" ? [{ label: "Check in", tone: "primary", onClick: () => patch(r, { status: "checked_in" }, "Patient checked in.") },
      { label: "Cancel", onClick: () => patch(r, { status: "cancelled" }, "Appointment cancelled.") }] : []} />;
}
