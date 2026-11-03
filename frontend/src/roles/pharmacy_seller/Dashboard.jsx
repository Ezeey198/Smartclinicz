import StatDashboard from "../../components/StatDashboard";

export default function Dashboard() {
  return <StatDashboard intro="Your sales today and what is running low."
    stats={[["sales_today", "My sales today"], ["revenue_today", "Sold today (UGX)", "money"], ["items_today", "Items sold"], ["low_stock", "Products running low"], ["expiring_soon", "Expiring in 90 days"]]}
    list="low_list" listKind="stock" listTitle="Running low"
    links={[["/app/sell", "Sell", "Open the counter"], ["/app/sales", "My sales", "Your receipts"], ["/app/products", "Products", "Prices and stock"], ["/app/wallet", "My wallet", "Payments you took"]]} />;
}
