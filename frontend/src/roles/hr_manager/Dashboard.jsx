import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="People, accounts and leave."
    stats={[["staff", "Staff accounts"], ["staff_pending", "Awaiting activation"], ["leave_pending", "Leave requests waiting"], ["on_leave", "On leave today"]]}
    links={[["/app/staff", "Staff directory", "Everyone who works here"], ["/app/leave", "Leave requests", "Record and approve leave"]]} />;
}
