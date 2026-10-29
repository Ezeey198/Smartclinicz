import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Payments received and money still owed."
    stats={[["wallet_balance", "Clinic wallet", "money"], ["payments_today", "Received today", "money"], ["collected", "Total collected", "money"], ["outstanding", "Still owed", "money"], ["invoices_unpaid", "Unpaid invoices"]]}
    links={[["/app/invoices", "Invoices", "Receive payments"], ["/app/receipts", "Receipts", "Payment history"]]} />;
}
