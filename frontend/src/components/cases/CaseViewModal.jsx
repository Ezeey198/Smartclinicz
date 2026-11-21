import { useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import { Modal, Notice, Spinner } from "../ui";
import CaseDetail from "./CaseDetail";

export default function CaseViewModal({ caseId, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get(`/cases/${caseId}`).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, [caseId]);
  return <Modal title={d ? `Case ${d.case.case_no}` : "Case"} onClose={onClose} wide>{err ? <Notice tone="error">{err}</Notice> : !d ? <Spinner /> : <CaseDetail d={d} />}</Modal>;
}
