import DataPage from "../../components/DataPage";
import { expenseColumns, expenseFields } from "../../config/schemas";

export default function Expenses() {
  return <DataPage module="accounts" title="Expenses" single="expense" createLabel="Record expense" empty="No expenses recorded yet."
    sub="Spending paid from the clinic wallet (or recorded as paid another way). Wallet expenses cannot be edited afterwards."
    columns={expenseColumns} fields={expenseFields} defaults={{ paid_from_wallet: "yes" }} />;
}
