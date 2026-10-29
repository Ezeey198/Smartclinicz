# ClinicPro - clinic management system (React + FastAPI)

## How it works
1. **Superadmin** signs in (no clinic code), registers a clinic with its full details, chooses **Class A** or **Class B** and enters the clinic admin's details.
2. The clinic and its admin account are created **inactive**, with a generated **clinic code** (e.g. `CLA-7K3MQ`). The admin receives **two emails**: *approve clinic* and *activate account* (set password).
3. The **clinic admin** signs in with *clinic code + email + password* and has full control of that clinic: staff, roles, settings and every module.
4. The admin adds staff. Roles offered depend on the class. Every new account stays **inactive until the person activates it from their emailed link**.

## Subscription, wallet and alerts
- **Subscription:** when the clinic admin approves a clinic it stays active for **2 hours** (free trial). After that the clinic becomes **inactive** until the clinic admin pays **UGX 1,000**, which activates it for **24 hours**. Paying again before it ends adds another 24 hours. While inactive, staff cannot sign in; the clinic admin can only renew, top up the wallet, or change their password. Settings: `TRIAL_HOURS`, `SUBSCRIPTION_PRICE`, `SUBSCRIPTION_HOURS` in `.env`.
- **Superadmin** can only *track* subscriptions (Subscriptions page: status, time left, payments, income). Superadmin cannot pay or change them.
- **Clinic wallet:** one balance per clinic. Money in: top-ups and patient payments (received by the admin, cashier, accountant or pharmacist). Money out: subscription, expenses and salaries marked "pay from wallet", and stock purchases. Every line records who handled it. Every role has a **My wallet** page with its own payments; roles that handle money also see the clinic balance.
- **Price list and automatic charges:** the accountant (or admin) sets prices (registration, consultation, each lab test, imaging exam, medicine). Registering a patient, booking an appointment, requesting a test or scan, or prescribing a drug raises an invoice automatically. Check-in, lab work, imaging and dispensing wait until the invoice is paid (the clinic admin can override).
- **Alerts:** the clinic admin gets an alert for every action by any user (who, role, time and the full details), with a counter, pop-up notices and an Alerts page.
- **Mobile money (real money):** set `PAYMENT_MODE=live` and add your MTN MoMo and/or Airtel Money keys in `backend/.env`. A top-up or subscription payment sends a payment request to the payer's phone; they approve it with their PIN; the app checks the result with the provider and credits the wallet **once, only after the provider confirms success**. With `PAYMENT_MODE=simulated` (default) payments are demo-only and nothing is charged.
  1. **MTN:** create an account at momodeveloper.mtn.com, subscribe to *Collections*, then run `python momo_sandbox_setup.py <subscription key>` to get sandbox keys and test. For production, MTN must approve your merchant account and give you production keys (`MTN_BASE_URL=https://proxy.momoapi.mtn.com`, `MTN_TARGET_ENV=mtnuganda`, `MTN_CURRENCY=UGX`).
  2. **Airtel:** register at developers.airtel.africa for a client id and secret (test server first, then production).
  3. Collected money lands in *your* merchant account with the provider. The wallet in the app is a record of each clinic's balance; paying clinics out is a separate arrangement.

## Every role has its own pages
Each role has its own folder in `frontend/src/roles/<role>/` with its own dashboard, pages and navigation. `roles/registry.js` maps a signed-in role to its folder.

| Role | Class | Pages |
|---|---|---|
| Superadmin | system | Overview, Clinics (register, details, approve/suspend), Email outbox, My account |
| Clinic admin | A, B | Dashboard, Patients, Appointments, Consultations, Laboratory, Pharmacy, Stock, Patient files, Staff, Clinic settings; plus Imaging, Billing, Expenses, Reports, Leave for Class A |
| Doctor | A, B | Dashboard, My appointments, Consultations, Lab requests, Prescriptions, Imaging requests (A), Patient files |
| Nurse | A, B | Dashboard, Triage and vitals, Check-in, Patients, Medications, Lab results, Patient files |
| Lab technician | A, B | Dashboard, Lab queue (start, enter result, complete), Patients |
| Pharmacist | A, B | Dashboard, Prescriptions (dispense), Pharmacy stock, Patients |
| Receptionist | A | Dashboard, Patient registration, Appointments, Invoices |
| Cashier | A | Dashboard, Invoices (receive payment), Receipts |
| Accountant | A | Dashboard, Invoices, Expenses, Financial reports |
| Radiologist | A | Dashboard, Imaging queue (start, report, release), Patients |
| Records officer | A | Dashboard, Patient register, Patient files, Appointments |
| Store keeper | A | Dashboard, Stock (receive, reorder alerts), Dispensing requests |
| HR manager | A | Dashboard, Staff directory, Leave requests (approve, reject) |

Class B clinics include billing, price list and expenses too, with the admin and pharmacist collecting payments. Class B clinics only have admin, doctor, nurse, lab technician and pharmacist. What each role may view or edit is defined in `backend/app/roles.py` and enforced by the API, not just hidden in the menu.

Frontend layout: `roles/*` (pages per role), `components/` (shell, data table and form engine, patient file, dashboard, payment modal), `config/schemas.jsx` (field and column definitions that pages pick from), `pages/` (login, approval and activation links).

## Run the backend (Python 3.10+)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # set SECRET_KEY and the superadmin password
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs. The superadmin is created on first start from `.env` (default `superadmin@clinicpro.local` / `ChangeMe123!`, change it).

**What is seeded:** only the superadmin (from `.env`), created automatically on first start or with `python seed.py`. There are no demo clinics or users.
The superadmin registers each clinic together with its clinic admin, and the system gives every clinic its own unique code. The clinic admin then creates all of the clinic's users. To start from a clean database, stop the server and delete `backend/clinic.db`.

## Run the frontend (Node 18+)
```bash
cd frontend
npm install
npm run dev        # open http://localhost:5173 or http://127.0.0.1:5173 (proxies /api to port 8000)
```
Start the backend first. If the page is blank in your browser, press F12, open the Console tab and note the red error; the app also prints load errors on screen.
```text
```

## Emails
With `SMTP_HOST` empty, emails are saved in the superadmin's **Email outbox** (and printed in the backend console) with working links. Set the `SMTP_*` values in `.env` to send real email, and set `FRONTEND_URL` to your public address.

## Production notes
Use PostgreSQL via `DATABASE_URL`, a long random `SECRET_KEY`, HTTPS, and serve the built frontend (`npm run build`) behind the same domain as `/api`.
