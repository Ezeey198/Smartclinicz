import superadmin from "./superadmin";
import admin from "./admin";
import doctor from "./doctor";
import nurse from "./nurse";
import lab_technician from "./lab_technician";
import pharmacist from "./pharmacist";
import receptionist from "./receptionist";
import accountant from "./accountant";
import radiologist from "./radiologist";
import pharmacy_admin from "./pharmacy_admin";
import pharmacy_seller from "./pharmacy_seller";

// Each role has its own folder, its own pages and its own navigation.
export const REGISTRY = { superadmin, admin, doctor, nurse, lab_technician, pharmacist, receptionist, accountant, radiologist, pharmacy_admin, pharmacy_seller };
