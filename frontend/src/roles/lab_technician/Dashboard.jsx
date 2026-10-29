import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Test requests waiting for you and results you have released."
    stats={[["lab_open", "Tests waiting"], ["lab_completed", "Results released"], ["patients", "Patients"]]}
    links={[["/app/queue", "Lab queue", "Process requests and enter results"], ["/app/patients", "Patients", "Look up patient details"]]} />;
}
