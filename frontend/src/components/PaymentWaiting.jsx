import { useEffect, useRef, useState } from "react";
import api from "../api";

// Shown after a payment request was sent to the customer's phone. Checks the result every few seconds.
export default function PaymentWaiting({ requestId, onSuccess, onFail }) {
  const [secs, setSecs] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const check = async () => {
      if (done.current) return;
      try {
        const { data } = await api.get(`/wallet/payments/${requestId}`);
        if (done.current) return;
        if (data.status === "successful") { done.current = true; onSuccess(data); }
        else if (data.status === "failed") { done.current = true; onFail(data.reason || "The payment was not approved."); }
      } catch { /* keep trying */ }
    };
    check();
    const poll = setInterval(check, 3000);
    const clock = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { done.current = true; clearInterval(poll); clearInterval(clock); };
  }, [requestId]);
  return (
    <div className="waiting">
      <div className="spin" />
      <h3>Approve the payment on your phone</h3>
      <p>A payment request was sent to your phone. Enter your mobile money PIN to approve it. This page updates by itself.</p>
      <p className="sub">Waiting {secs}s</p>
    </div>
  );
}
