import StockManager from "../../components/StockManager";

// The laboratory's own stock: equipment, reagents and chemicals, with the same batch records and alerts as the pharmacy.
export default function LabStock() {
  return <StockManager mode="lab" />;
}
