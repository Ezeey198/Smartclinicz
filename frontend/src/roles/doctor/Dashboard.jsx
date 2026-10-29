import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Your patients, results and prescriptions at a glance."
    stats={[["my_appointments", "My appointments today"], ["appointments_today", "Clinic appointments today"], ["lab_completed", "Lab results ready"], ["imaging_reported", "Imaging reports ready"], ["patients", "Patients"]]}
    list="my_list" listTitle="My appointments today"
    links={[["/app/appointments", "My appointments", "Today's queue"], ["/app/consultations", "Consultations", "Diagnosis and treatment notes"],
      ["/app/lab", "Lab requests", "Order tests, read results"], ["/app/prescriptions", "Prescriptions", "Send drugs to the pharmacy"],
      ["/app/imaging", "Imaging requests", "X-ray, ultrasound and more", "imaging"], ["/app/files", "Patient files", "Full patient history"]]} />;
}
