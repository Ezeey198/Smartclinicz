import { useState } from "react";
import api, { errMsg } from "../api";
import { Input, Modal, Notice, money } from "./ui";

export default function PayModal({ invoice, onClose, onDone }) {
  const balance = (invoice.amount || 0) - (invoice.paid || 0);
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("cash");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post(`/billing/${invoice.id}/pay`, { amount: Number(amount), method }); onDone(); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Modal title={`Receive payment · ${invoice.invoice_no}`} onClose={onClose}>
      <form onSubmit={submit}>
        <dl className="facts"><dt>Patient</dt><dd>{invoice.patient_name}</dd><dt>For</dt><dd>{invoice.description}</dd><dt>Balance</dt><dd><b>{money(balance)}</b></dd></dl>
        <div className="grid2" style={{ marginTop: 14 }}>
          <Input label="Amount received" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Input label="Method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {["cash", "mobile money", "card", "bank transfer"].map((m) => <option key={m}>{m}</option>)}</select></Input>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Record payment</button></div>
      </form>
    </Modal>
  );
}
