// One stamp as it appears on a document: the clinic stamp, the date it was put on, and the clinic name. No staff name appears on a document.
export const fmtStampDate = (v) => {
  const d = v ? new Date(typeof v === "string" && !/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v + "Z" : v) : new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
};

export default function Stamp({ image, ink = "#1b3a8a", date, clinic }) {
  return (
    <figure className="stamp-block">
      <img src={image} alt="Clinic stamp" />
      <div className="stamp-date" style={{ color: ink, borderColor: ink }}>{fmtStampDate(date)}</div>
      {clinic && <figcaption><b>{clinic}</b></figcaption>}
    </figure>
  );
}
