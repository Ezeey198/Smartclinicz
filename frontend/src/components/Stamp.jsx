// One stamp as it appears on a document: the clinic stamp, today's date, and the name of the person who used it below.
export const fmtStampDate = (v) => {
  const d = v ? new Date(typeof v === "string" && !/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v + "Z" : v) : new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
};
const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

export default function Stamp({ image, ink = "#1b3a8a", date, name, role }) {
  return (
    <figure className="stamp-block">
      <img src={image} alt="Clinic stamp" />
      <div className="stamp-date" style={{ color: ink, borderColor: ink }}>{fmtStampDate(date)} <span>{fmtTime(date)}</span></div>
      <figcaption><b>{name}</b>{role && <span>{role}</span>}</figcaption>
    </figure>
  );
}
