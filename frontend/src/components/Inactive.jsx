import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Inactive() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="link-page"><div className="link-card">
      <div className="brand dark">ClinicPro</div>
      <h2>This clinic or pharmacy is inactive</h2>
      <p>The subscription has ended. The admin needs to renew it before staff can use the system again.</p>
      <button className="btn primary" onClick={() => { logout(); nav("/login"); }}>Sign out</button>
    </div></div>
  );
}
