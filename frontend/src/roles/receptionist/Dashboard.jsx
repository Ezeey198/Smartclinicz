import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Front desk: registrations, bookings and today's arrivals."
    stats={[["appointments_today", "Appointments today"], ["checked_in", "Checked in"], ["patients", "Patients"], ["invoices_unpaid", "Unpaid invoices"]]}
    list="today_list" listTitle="Today's appointments"
    links={[["/app/patients", "Patients", "Register new patients"], ["/app/appointments", "Appointments", "Book and check in"], ["/app/invoices", "Invoices", "Raise bills for patients", "billing"]]} />;
}
