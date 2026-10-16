/** Catalogue of entitlement keys that plans can include. Checked server-side via hasEntitlement(). */
export const PRO_FEATURES: { key: string; label: string; description: string }[] = [
  { key: "pro.badge", label: "Pro badge", description: "Shows a Pro badge on the member's profile." },
  { key: "pro.analytics", label: "Extended analytics", description: "Longer history and more detail in listing analytics." },
  { key: "pro.extra_listings", label: "Higher listing limits", description: "Raises the number of active listings and promotions." },
  { key: "pro.priority_support", label: "Priority support", description: "Support tickets are triaged first." },
  { key: "pro.team_seats", label: "Extra team seats", description: "More members per company or shop." },
];
