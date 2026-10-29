import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Patient registers and medical records."
    stats={[["patients", "Patients on record"], ["appointments_today", "Appointments today"], ["visits_today", "Consultations today"]]}
    links={[["/app/patients", "Patient register", "Add and correct patient details"], ["/app/files", "Patient files", "Open a full patient history"], ["/app/appointments", "Appointments", "View bookings"]]} />;
}
