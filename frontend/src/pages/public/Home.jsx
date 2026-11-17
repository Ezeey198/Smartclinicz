import { useEffect } from "react";
import Tiles from "./Tiles";
// The landing page: the top bar (brand, About, Clinics, Sign in) and, filling the rest of the screen, three tiles of sliding clinic photos
// above three tiles of sliding clinic videos. Everything comes from what registered clinics have uploaded.
export default function Home() {
  useEffect(() => { document.documentElement.classList.add("tiles-home"); return () => document.documentElement.classList.remove("tiles-home"); }, []);
  return <Tiles />;
}
