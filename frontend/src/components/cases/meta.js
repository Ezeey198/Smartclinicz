export const STAGES = [
  ["with_doctor", "With the doctor"], ["at_lab", "At the lab"], ["back_to_doctor", "Back with the doctor"],
  ["at_pharmacy", "At the pharmacy"], ["awaiting_payment", "Awaiting payment"], ["completed", "Completed"],
];
export const STAGE_LABEL = Object.fromEntries(STAGES);
export const EVENT_LABEL = {
  opened: "Patient received", consultation_saved: "Consultation notes saved", forwarded_to_lab: "Sent to the lab", lab_started: "Lab test started",
  lab_completed: "Lab test completed", returned_to_doctor: "Results returned to the doctor", forwarded_to_pharmacy: "Sent to the pharmacy",
  dispensed: "Drugs dispensed and sold", prescription_cancelled: "Drug not supplied", charge_added: "Item added to the bill", billed: "Bill generated",
  payment: "Payment received", closed: "Case completed",
};
