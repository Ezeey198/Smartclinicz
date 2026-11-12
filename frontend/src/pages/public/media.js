import { API_BASE } from "../../api";

export const mediaUrl = (id) => `${API_BASE}/public/media/${id}`;
export const kindLabel = (c) => (c.type === "pharmacy" ? "Pharmacy" : "Clinic");
const where = (l) => [l.address, l.city].filter(Boolean).join(", ");
// A location with an exact position (detected by the admin) is shown and routed by its coordinates; otherwise by its address.
const hasPin = (l) => l.latitude !== null && l.latitude !== undefined && l.longitude !== null && l.longitude !== undefined;
const pin = (l) => `${l.latitude},${l.longitude}`;
export const hasMap = (l) => hasPin(l) || !!l.address;
export const mapLink = (l) => (hasPin(l) ? `https://www.google.com/maps/search/?api=1&query=${pin(l)}` : l.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where(l))}`);
export const mapEmbed = (l) => `https://www.google.com/maps?q=${encodeURIComponent(hasPin(l) ? pin(l) : where(l))}&output=embed`;
export const initials = (name) => (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
