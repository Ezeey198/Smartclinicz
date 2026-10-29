import DataPage from "../../components/DataPage";
import { RX_STATUS, rxColumns, rxFields } from "../../config/schemas";

export default function Prescriptions() {
  return <DataPage module="pharmacy" title="Prescriptions" single="prescription" createLabel="Walk-in prescription" empty="No prescriptions yet."
    sub="Dispense what the doctors prescribed." columns={rxColumns} fields={rxFields} statuses={RX_STATUS}
    tabs={[{ key: "pend", label: "Waiting", filter: (r) => r.status === "pending" }, { key: "done", label: "Dispensed", filter: (r) => r.status === "dispensed" }, { key: "all", label: "All", filter: () => true }]}
    rowActions={(r, { patch }) => r.status === "pending" ? [{ label: "Dispense", tone: "primary", onClick: () => patch(r, { status: "dispensed" }, "Marked as dispensed.") },
      { label: "Cancel", onClick: () => patch(r, { status: "cancelled" }, "Prescription cancelled.") }] : []} />;
}
