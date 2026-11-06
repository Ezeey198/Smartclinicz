import { API_BASE } from "../../api";

export const mediaUrl = (id) => `${API_BASE}/public/media/${id}`;
export const kindLabel = (c) => (c.type === "pharmacy" ? "Pharmacy" : c.clinic_class === "A" ? "Clinic · full service" : "Clinic · essential");
const where = (l) => [l.address, l.city].filter(Boolean).join(", ");
export const mapLink = (l) => l.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where(l))}`;
export const mapEmbed = (l) => `https://www.google.com/maps?q=${encodeURIComponent(where(l))}&output=embed`;
export const initials = (name) => (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
