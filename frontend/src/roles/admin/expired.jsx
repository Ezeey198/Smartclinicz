import Subscription from "./Subscription";
import Wallet from "./Wallet";
import Account from "../shared/Account";

// When the subscription has ended the clinic admin can only renew, top up the wallet, or manage their account.
export default {
  nav: [
    { to: "/app", label: "Renew subscription", icon: "BadgeCheck", end: true },
    { to: "/app/wallet", label: "Wallet", icon: "Wallet" },
    { to: "/app/account", label: "My account", icon: "CircleUser" },
  ],
  routes: [{ index: true, element: <Subscription /> }, { path: "wallet", element: <Wallet /> }, { path: "account", element: <Account /> }],
};
