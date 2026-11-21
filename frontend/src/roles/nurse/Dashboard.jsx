import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Triage, vital signs and patient flow."
    stats={[["appointments_today", "Appointments today"], ["checked_in", "Checked in"], ["visits_today", "Vitals recorded today"], ["lab_open", "Lab tests pending"], ["patients", "Patients"]]}
    list="today_list" listTitle="Today's appointments"
    links={[["/app/triage", "Triage and vitals", "Record vital signs"], ["/app/appointments", "Check-in", "Receive arriving patients"], ["/app/patients", "Patients", "Register and update"],
      ["/app/medications", "Medications", "What was prescribed"], ["/app/lab", "Lab results", "Results for your patients"], ["/app/files", "Patient files", "Full patient history"]]} />;
}
