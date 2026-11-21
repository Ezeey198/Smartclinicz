import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Imaging requests waiting and reports you have released."
    stats={[["imaging_open", "Waiting for imaging"], ["imaging_reported", "Reports released"], ["patients", "Patients"]]}
    links={[["/app/imaging", "Imaging queue", "Perform and report examinations"], ["/app/patients", "Patients", "Look up patient details"]]} />;
}
