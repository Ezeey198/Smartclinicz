import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Billing, spending and the clinic's financial position."
    stats={[["wallet_balance", "Clinic wallet", "money"], ["collected", "Collected", "money"], ["outstanding", "Still owed", "money"], ["expenses_total", "Expenses", "money"], ["invoices_unpaid", "Unpaid invoices"]]}
    links={[["/app/invoices", "Invoices", "All billing"], ["/app/expenses", "Expenses", "Record spending"], ["/app/reports", "Reports", "Income and spending by month"]]} />;
}
