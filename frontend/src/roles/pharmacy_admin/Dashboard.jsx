import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Sales, stock and money for the whole pharmacy."
    stats={[["revenue_today", "Sold today (UGX)", "money"], ["sales_today", "Sales today"], ["revenue_month", "Sold this month (UGX)", "money"], ["wallet_balance", "Wallet balance", "money"],
      ["low_stock", "Products running low"], ["expiring_soon", "Expiring in 90 days"], ["expired_batches", "Expired batches"], ["stock_value", "Stock value at cost", "money"], ["products", "Products"], ["staff", "Staff"], ["alerts", "New alerts"]]}
    list="low_list" listKind="stock" listTitle="Running low"
    links={[["/app/sell", "Sell", "Open the counter"], ["/app/sales", "Sales", "Every sale and who made it"], ["/app/products", "Products", "Prices and stock"], ["/app/purchases", "Purchases", "Receive stock from suppliers"],
      ["/app/expiry", "Expiry", "Expired and expiring stock"], ["/app/reports", "Reports", "Sales, profit and top sellers"], ["/app/activity", "Alerts", "Who did what, and when"], ["/app/staff", "Staff", "Add sellers"]]} />;
}
