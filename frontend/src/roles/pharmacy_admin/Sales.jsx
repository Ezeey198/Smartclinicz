import SalesTable from "../../components/pharmacy/SalesTable";

export default function Sales() {
  return <SalesTable scope="all" canVoid title="Sales" sub="Every sale in the pharmacy, who sold it and how it was paid. Cancel a sale to put the stock back and take the money out of the wallet." />;
}
