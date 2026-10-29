import DataPage from "../../components/DataPage";
import { IMG_STATUS, imagingColumns, imagingRequestFields } from "../../config/schemas";

export default function ImagingRequests() {
  return <DataPage module="imaging" title="Imaging requests" single="imaging request" createLabel="Request imaging" empty="No imaging requests yet."
    sub="Request X-rays, scans and ultrasounds." columns={imagingColumns} fields={imagingRequestFields} statuses={IMG_STATUS} />;
}
