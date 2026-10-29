import { Pill } from "../../components/ui";

export const statusPill = (s) => <Pill value={s}>{s === "pending" ? "Awaiting approval" : s[0].toUpperCase() + s.slice(1)}</Pill>;
