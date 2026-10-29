import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="You have full control of this clinic."
    stats={[["patients", "Patients"], ["appointments_today", "Appointments today"], ["lab_open", "Lab tests pending"], ["rx_pending", "Prescriptions waiting"],
      ["low_stock", "Low stock"], ["invoices_unpaid", "Unpaid invoices"], ["wallet_balance", "Wallet balance", "money"], ["alerts", "New alerts"], ["collected", "Collected", "money"], ["staff", "Staff accounts"], ["staff_pending", "Awaiting activation"]]}
    list="today_list" listTitle="Today's appointments"
    links={[["/app/activity", "Alerts", "Who did what, and when"], ["/app/subscription", "Subscription", "Keep the clinic active"], ["/app/wallet", "Wallet", "Payments and balance"], ["/app/staff", "Staff", "Add people and manage roles"], ["/app/settings", "Clinic settings", "Profile and details"], ["/app/patients", "Patients", "Registers and details"],
      ["/app/appointments", "Appointments", "Bookings"], ["/app/consultations", "Consultations", "Clinical notes"], ["/app/lab", "Laboratory", "Tests and results"],
      ["/app/pharmacy", "Pharmacy", "Prescriptions"], ["/app/stock", "Stock", "Inventory"], ["/app/imaging", "Imaging", "Scans and reports", "imaging"],
      ["/app/billing", "Billing", "Invoices and payments", "billing"], ["/app/reports", "Reports", "Financial summary", "accounts"], ["/app/files", "Patient files", "Full histories"]]} />;
}
