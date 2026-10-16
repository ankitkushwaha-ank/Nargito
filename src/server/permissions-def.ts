export const PERMISSIONS: { key: string; group: string; description: string }[] = [
  { key: "admin.access", group: "Admin", description: "Open the administration panel" },
  { key: "analytics.read", group: "Admin", description: "View dashboards and analytics" },
  { key: "analytics.export", group: "Admin", description: "Export analytics data" },
  { key: "users.read", group: "Users", description: "View users" },
  { key: "users.manage", group: "Users", description: "Edit user accounts and notes" },
  { key: "users.suspend", group: "Users", description: "Suspend, restrict or ban users" },
  { key: "roles.manage", group: "Users", description: "Manage roles and permissions" },
  { key: "verification.manage", group: "Users", description: "Review verification requests" },
  { key: "content.read", group: "Content", description: "List platform content" },
  { key: "content.moderate", group: "Content", description: "Hide, restore and remove content" },
  { key: "reports.manage", group: "Content", description: "Handle reports" },
  { key: "cms.manage", group: "Content", description: "Edit CMS pages" },
  { key: "cms.legal", group: "Content", description: "Edit legal pages" },
  { key: "settings.general", group: "Configuration", description: "General and website settings" },
  { key: "settings.maintenance", group: "Configuration", description: "Maintenance mode" },
  { key: "settings.uploads", group: "Configuration", description: "Upload settings" },
  { key: "settings.integrations", group: "Configuration", description: "Email, SMS, chat, social login, AI, runtime" },
  { key: "settings.pwa", group: "Configuration", description: "PWA and mobile settings" },
  { key: "settings.posts", group: "Configuration", description: "Post and feed settings" },
  { key: "settings.design", group: "Configuration", description: "Design and themes" },
  { key: "settings.seo", group: "Configuration", description: "SEO and redirects" },
  { key: "features.manage", group: "Configuration", description: "Toggle platform features" },
  { key: "languages.manage", group: "Configuration", description: "Manage languages and translations" },
  { key: "ads.manage", group: "Monetization", description: "Manage promotions and ad policy" },
  { key: "pro.manage", group: "Monetization", description: "Manage plans, members, payments and refunds" },
  { key: "logs.read", group: "Operations", description: "Read system logs" },
  { key: "audit.read", group: "Operations", description: "Read audit logs" },
  { key: "health.read", group: "Operations", description: "View system health" },
  { key: "jobs.manage", group: "Operations", description: "Manage scheduled jobs" },
  { key: "tools.run", group: "Operations", description: "Run admin tools" },
  { key: "security.manage", group: "Security", description: "Security events, sessions and emergency controls" },
  { key: "approvals.decide", group: "Security", description: "Approve critical actions requested by others" },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const without = (...ks: string[]) => ALL_PERMISSION_KEYS.filter((k) => !ks.includes(k));

export const DEFAULT_ROLES: { name: string; description: string; permissions: string[] }[] = [
  { name: "superadmin", description: "Full access. Protected role.", permissions: ALL_PERMISSION_KEYS },
  { name: "admin", description: "Operational administrator", permissions: without("roles.manage", "cms.legal") },
  { name: "moderator", description: "Content and user moderation", permissions: ["admin.access", "analytics.read", "users.read", "users.suspend", "verification.manage", "content.read", "content.moderate", "reports.manage"] },
  { name: "support", description: "Support staff", permissions: ["admin.access", "users.read", "content.read", "reports.manage"] },
  { name: "content_manager", description: "Pages, SEO and categories", permissions: ["admin.access", "content.read", "cms.manage", "settings.seo"] },
  { name: "finance", description: "Monetization and payments", permissions: ["admin.access", "analytics.read", "analytics.export", "ads.manage", "pro.manage"] },
];
