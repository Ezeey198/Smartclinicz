import { useState } from "react";
import DataPage from "../../components/DataPage";
import OpenCaseModal from "../../components/cases/OpenCaseModal";
import { DOCS } from "../../config/documents";
import { patientColumns, patientFields } from "../../config/schemas";

export default function Patients() {
  const [recv, setRecv] = useState(null);
  const [k, setK] = useState(0);
  return (
    <>
      <DataPage key={k} docBuilder={DOCS.patient_summary} module="patients" title="Patient registration" single="patient" createLabel="Register patient" empty="No patients yet. Register the first patient."
        sub="Register patients and keep their contact details up to date. For a patient who is back, press Receive visit to assign a doctor." columns={patientColumns} fields={patientFields}
        rowActions={(r) => [{ label: "Receive visit", tone: "primary", onClick: () => setRecv(r) }]} />
      {recv && <OpenCaseModal reception presetPatient={recv} onClose={() => setRecv(null)} onDone={() => { setRecv(null); setK(k + 1); }} />}
    </>
  );
}
