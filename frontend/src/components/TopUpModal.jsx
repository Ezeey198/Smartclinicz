import { useEffect, useState } from "react";
import api, { errMsg } from "../api";
import PaymentWaiting from "./PaymentWaiting";
import { Input, Modal, Notice, ugx } from "./ui";

export default function TopUpModal({ onClose, onDone, suggested = 1000 }) {
  const [opt, setOpt] = useState(null);
  const [amount, setAmount] = useState(suggested);
  const [method, setMethod] = useState("mobile_money");
  const [network, setNetwork] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [waiting, setWaiting] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/wallet/options").then((r) => { setOpt(r.data); setNetwork(r.data.networks[0]?.id || ""); }).catch((e) => setErr(errMsg(e))); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data } = await api.post("/wallet/topup", { amount: Number(amount), method, network, phone });
      if (data.status === "pending") setWaiting(data.request_id); else onDone();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Top up the clinic wallet" onClose={onClose}>
      {!opt ? <p>Loading…</p> : waiting ? (
        <PaymentWaiting requestId={waiting} onSuccess={onDone} onFail={(r) => { setWaiting(null); setErr(r); }} />
      ) : (
        <form onSubmit={submit}>
          {opt.networks.length === 0 && <Notice tone="error">Live payments are on, but no mobile money provider has its keys set in backend/.env.</Notice>}
          <div className="grid2">
            <Input label="Amount (UGX)" type="number" min="500" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input label="Pay with"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="mobile_money">Mobile money</option>{opt.card && <option value="card">Card (demo)</option>}</select></Input>
            {method === "mobile_money" && (
              <>
                <Input label="Network"><select className="input" value={network} onChange={(e) => setNetwork(e.target.value)} required>
                  {opt.networks.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Input>
                <Input label="Mobile money number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" required />
              </>
            )}
          </div>
          <Notice>{opt.live ? `A payment request for ${ugx(amount)} will be sent to that phone. The wallet is credited only after it is approved.` : `Demo mode: this payment is simulated and no real money moves. You are adding ${ugx(amount)}.`}</Notice>
          {err && <Notice tone="error">{err}</Notice>}
          <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={busy || (method === "mobile_money" && opt.networks.length === 0)}>{busy ? "Sending…" : opt.live ? "Send payment request" : "Add to wallet"}</button></div>
        </form>
      )}
    </Modal>
  );
}
