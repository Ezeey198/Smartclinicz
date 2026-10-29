"""Creates an MTN MoMo SANDBOX API user and key, then prints the lines to paste into .env.
Usage:  python momo_sandbox_setup.py <your Collections subscription key>
Get the subscription key by subscribing to the 'Collections' product at https://momodeveloper.mtn.com"""
import sys
import uuid
import httpx

BASE = "https://sandbox.momodeveloper.mtn.com"
if len(sys.argv) < 2:
    sys.exit(__doc__)
key = sys.argv[1]
user = str(uuid.uuid4())
r = httpx.post(f"{BASE}/v1_0/apiuser", headers={"Ocp-Apim-Subscription-Key": key, "X-Reference-Id": user, "Content-Type": "application/json"},
               json={"providerCallbackHost": "example.com"})
r.raise_for_status()
r = httpx.post(f"{BASE}/v1_0/apiuser/{user}/apikey", headers={"Ocp-Apim-Subscription-Key": key})
r.raise_for_status()
print("\nPaste these into backend/.env, then set PAYMENT_MODE=live:\n")
print(f"MTN_SUBSCRIPTION_KEY={key}\nMTN_API_USER={user}\nMTN_API_KEY={r.json()['apiKey']}\nMTN_BASE_URL={BASE}\nMTN_TARGET_ENV=sandbox\nMTN_CURRENCY=EUR")
print("\nIn the sandbox, test numbers such as 46733123450 succeed and 46733123451 fail (see the MTN docs).")
