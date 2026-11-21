import axios from "axios";
import { API_BASE } from "../../api";
import { store } from "../../storage";

export const PATIENT_TOKEN = "clinicpro_patient_token";
// The patient's own connection. It uses the patient's token, never a staff token, and sends the patient back to sign in when the session ends.
const portal = axios.create({ baseURL: API_BASE });
portal.interceptors.request.use((c) => { const t = store.get(PATIENT_TOKEN); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
portal.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && store.get(PATIENT_TOKEN) && !String(e.config?.url || "").includes("/portal/login")) {
    store.del(PATIENT_TOKEN);
    window.location.assign("/patient?ended=1");
  }
  return Promise.reject(e);
});
export default portal;
