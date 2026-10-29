import DataPage from "../../components/DataPage";
import { LEAVE_STATUS, leaveColumns, leaveFields } from "../../config/schemas";

export default function LeaveRequests() {
  return <DataPage module="hr" title="Leave requests" single="leave request" createLabel="Record leave" empty="No leave recorded yet."
    sub="Record staff leave and approve or reject it." columns={leaveColumns} fields={leaveFields} statuses={LEAVE_STATUS}
    tabs={[{ key: "pend", label: "Waiting", filter: (r) => r.status === "pending" }, { key: "all", label: "All", filter: () => true }]}
    rowActions={(r, { patch }) => r.status === "pending" ? [{ label: "Approve", tone: "primary", onClick: () => patch(r, { status: "approved" }, "Leave approved.") },
      { label: "Reject", onClick: () => patch(r, { status: "rejected" }, "Leave rejected.") }] : []} />;
}
