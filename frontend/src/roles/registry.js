import superadmin from "./superadmin";
import admin from "./admin";
import doctor from "./doctor";
import nurse from "./nurse";
import lab_technician from "./lab_technician";
import pharmacist from "./pharmacist";
import receptionist from "./receptionist";
import cashier from "./cashier";
import accountant from "./accountant";
import radiologist from "./radiologist";
import records_officer from "./records_officer";
import store_keeper from "./store_keeper";
import hr_manager from "./hr_manager";

// Each role has its own folder, its own pages and its own navigation.
export const REGISTRY = { superadmin, admin, doctor, nurse, lab_technician, pharmacist, receptionist, cashier, accountant, radiologist, records_officer, store_keeper, hr_manager };
