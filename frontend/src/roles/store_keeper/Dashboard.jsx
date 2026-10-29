import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Stock levels and what needs reordering."
    stats={[["stock_items", "Stock items"], ["low_stock", "Low stock"], ["rx_pending", "Prescriptions waiting"]]}
    list="low_list" listKind="stock" listTitle="Running low"
    links={[["/app/stock", "Stock", "Receive, count and reorder"], ["/app/requests", "Dispensing requests", "What the pharmacy needs"]]} />;
}
