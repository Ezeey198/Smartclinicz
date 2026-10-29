import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Prescriptions to dispense and stock that is running low."
    stats={[["payments_today", "Received today", "money"], ["rx_pending", "Waiting to dispense"], ["rx_dispensed", "Dispensed"], ["stock_items", "Stock items"], ["low_stock", "Low stock"]]}
    list="low_list" listKind="stock" listTitle="Running low"
    links={[["/app/prescriptions", "Prescriptions", "Dispense to patients"], ["/app/stock", "Pharmacy stock", "Check and update stock"], ["/app/patients", "Patients", "Look up patients"]]} />;
}
