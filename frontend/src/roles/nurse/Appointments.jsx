import DataPage from "../../components/DataPage";
import { DOCS } from "../../config/documents";
import { APPT_STATUS, apptColumns, apptFields } from "../../config/schemas";

export default function Appointments() {
  return <DataPage docBuilder={DOCS.appointment_slip} module="appointments" title="Patient check-in" single="appointment" empty="No appointments yet."
    sub="Check patients in as they arrive." columns={apptColumns} fields={apptFields} statuses={APPT_STATUS}
    tabs={[{ key: "wait", label: "Expected", filter: (r) => r.status === "scheduled" }, { key: "in", label: "Checked in", filter: (r) => r.status === "checked_in" }, { key: "all", label: "All", filter: () => true }]}
    rowActions={(r, { patch }) => r.status === "scheduled" ? [{ label: "Check in", tone: "primary", onClick: () => patch(r, { status: "checked_in" }, "Patient checked in.") }] : []} />;
}
