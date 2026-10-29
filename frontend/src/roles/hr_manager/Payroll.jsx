import DataPage from "../../components/DataPage";
import { payrollColumns, payrollFields } from "../../config/schemas";

export default function Payroll() {
  return <DataPage module="payroll" title="Salary payments" single="salary payment" createLabel="Pay salary" noEdit empty="No salaries paid yet."
    sub="Each salary is paid out of the clinic wallet and shows up in the wallet history and the admin's alerts." columns={payrollColumns} fields={payrollFields} />;
}
