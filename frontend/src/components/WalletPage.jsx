// Shared wallet view. Money roles see the clinic balance and all activity; everyone sees their own payments.
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import { Empty, Notice, PageHead, Pill, Spinner, fmtStamp, label, ugx } from "./ui";
import TopUpModal from "./TopUpModal";

const KIND = { topup: ["blue", "Top-up"], subscription: ["amber", "Subscription"], payment_received: ["green", "Payment received"],
  expense: ["coral", "Expense"], stock_purchase: ["coral", "Stock purchase"], salary: ["coral", "Salary"] };

export default function WalletPage() {
  const { user, refresh } = useAuth();
  const [sum, setSum] = useState(null);
  const [rows, setRows] = useState(null);
  const [scope, setScope] = useState("mine");
  const [top, setTop] = useState(false);
  const [err, setErr] = useState("");
  const load = (s = scope) => {
    api.get("/wallet/summary").then((r) => setSum(r.data)).catch((e) => setErr(errMsg(e)));
    api.get(`/wallet/transactions?scope=${s}`).then((r) => setRows(r.data)).catch((e) => setErr(errMsg(e)));
  };
  useEffect(() => { load(); }, []);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!sum || !rows) return <Spinner />;
  const see = sum.can_see_balance;
  const cells = see
    ? [["Clinic wallet balance", ugx(sum.balance)], ["In today", ugx(sum.today_in)], ["Out today", ugx(sum.today_out)], ["I handled (in)", ugx(sum.mine_in)], ["I paid out", ugx(sum.mine_out)]]
    : [["Payments I made or received", sum.mine_count], ["Money in through me", ugx(sum.mine_in)], ["Money out through me", ugx(sum.mine_out)]];

  return (
    <>
      <PageHead title="Wallet" sub={see ? "The clinic wallet: every payment in and out, and who handled it." : "Payments you have handled for the clinic."}>
        {sum.can_topup && <button className="btn primary" onClick={() => setTop(true)}><Plus size={16} />Top up</button>}
      </PageHead>
      <div className="strip">{cells.map(([l, n]) => <div key={l} className="strip-item"><b>{n}</b><span>{l}</span></div>)}</div>
      {see && (
        <div className="tabs-line" style={{ marginTop: 18 }}>
          {[["mine", "My transactions"], ["all", "Whole clinic"]].map(([k, l]) => (
            <button key={k} className={scope === k ? "on" : ""} onClick={() => { setScope(k); setRows(null); load(k); }}>{l}</button>))}
        </div>
      )}
      <div className="panel" style={{ marginTop: see ? 0 : 18 }}>
        {rows.length === 0 ? <Empty text="No transactions yet." /> : (
          <div className="scroll"><table className="table">
            <thead><tr><th>When</th><th>Type</th><th>Details</th>{scope === "all" && <th>By</th>}<th>Method</th><th>Amount</th>{see && <th>Balance after</th>}</tr></thead>
            <tbody>{rows.map((t) => (
              <tr key={t.id}>
                <td className="sub">{fmtStamp(t.created_at)}</td>
                <td><Pill tone={(KIND[t.kind] || ["gray"])[0]}>{(KIND[t.kind] || [, label(t.kind)])[1]}</Pill></td>
                <td>{t.description}{t.reference && <div className="sub">Ref {t.reference}</div>}</td>
                {scope === "all" && <td>{t.user_name}<div className="sub">{label(t.role)}</div></td>}
                <td>{label(t.method)}</td>
                <td><b className={t.amount >= 0 ? "amt-in" : "amt-out"}>{t.amount >= 0 ? "+" : "-"}{ugx(Math.abs(t.amount))}</b></td>
                {see && <td>{ugx(t.balance_after)}</td>}
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
      {top && <TopUpModal onClose={() => setTop(false)} onDone={() => { setTop(false); load(); refresh(); }} />}
    </>
  );
}
