/**
 * Typed registry of every admin-editable setting. The admin UI is generated from this list and every value is
 * validated against it on save. Secrets are NEVER part of this registry - they come from environment variables.
 */
export type SettingType = "boolean" | "number" | "string" | "text" | "select" | "list" | "color";
export type SettingDef = {
  key: string;
  group: string;
  label: string;
  help?: string;
  type: SettingType;
  default: string | number | boolean | string[];
  options?: string[];
  min?: number;
  max?: number;
  sensitive?: boolean; // requires step-up confirmation in the admin UI
};

export const SETTING_GROUPS: { id: string; label: string; description: string; permission: string }[] = [
  { id: "general", label: "General", description: "Site identity, locale, registration and global defaults.", permission: "settings.general" },
  { id: "website", label: "Website information", description: "Public brand copy, footer and social links.", permission: "settings.general" },
  { id: "maintenance", label: "Maintenance mode", description: "Take the public site offline with a message. Administrators keep access.", permission: "settings.maintenance" },
  { id: "uploads", label: "File uploads", description: "Limits and allowed types. Enforced on the server for every upload.", permission: "settings.uploads" },
  { id: "email_sms", label: "Email & SMS", description: "Sender identity, OTP policy and provider selection. Provider credentials come from environment variables.", permission: "settings.integrations" },
  { id: "chat", label: "Chat & calls", description: "Messaging policy. Voice/video calling is not implemented.", permission: "settings.integrations" },
  { id: "social", label: "Social login", description: "Enable Google / Facebook sign-in once credentials are configured.", permission: "settings.integrations" },
  { id: "runtime", label: "Runtime & realtime", description: "Safe runtime tuning. No code execution is possible from this screen.", permission: "settings.integrations" },
  { id: "ai", label: "AI", description: "Optional AI assistance. Disabled unless a provider key is configured.", permission: "settings.integrations" },
  { id: "pwa", label: "PWA", description: "Drives the web app manifest and install behaviour.", permission: "settings.pwa" },
  { id: "mobile", label: "Mobile app", description: "PWA status, deep links and native store links (only shown if set).", permission: "settings.pwa" },
  { id: "posts", label: "Posts & feed", description: "Publishing limits and feed behaviour.", permission: "settings.posts" },
  { id: "design", label: "Design & themes", description: "Approved design tokens applied across the site.", permission: "settings.design" },
  { id: "seo", label: "SEO", description: "Global metadata defaults and indexing.", permission: "settings.seo" },
  { id: "ads", label: "Advertising", description: "Promotion policy and limits.", permission: "ads.manage" },
  { id: "pro", label: "Pro & payments", description: "Premium membership availability.", permission: "pro.manage" },
  { id: "location", label: "Location", description: "Privacy-preserving nearby discovery.", permission: "settings.general" },
];

const S = (key: string, group: string, label: string, type: SettingType, def: SettingDef["default"], extra: Partial<SettingDef> = {}): SettingDef => ({ key, group, label, type, default: def, ...extra });

export const SETTINGS: SettingDef[] = [
  S("site.name", "general", "Site name", "string", "Nargito"),
  S("site.description", "general", "Site description", "text", "Connect, share trips, discover local businesses and trade through enquiries on Nargito."),
  S("site.baseUrl", "general", "Base URL", "string", "http://localhost:3000", { help: "Canonical origin used in sitemaps, emails and metadata." }),
  S("site.defaultLocale", "general", "Default language code", "string", "en", { help: "Must be an enabled language. Prefer changing it from Languages > Set default." }),
  S("site.timezone", "general", "Default timezone", "string", "Asia/Kolkata"),
  S("registration.enabled", "general", "Allow new registrations", "boolean", true, { sensitive: true }),
  S("registration.requireEmailVerification", "general", "Require verified email to post and message", "boolean", true),
  S("contact.email", "general", "Public contact email", "string", "hello@nargito.example"),
  S("contact.phone", "general", "Public contact phone", "string", ""),
  S("support.url", "general", "Support URL", "string", "/help"),
  S("defaults.pageSize", "general", "Default list page size", "number", 20, { min: 5, max: 100 }),
  S("defaults.profileVisibility", "general", "Default profile visibility", "select", "public", { options: ["public", "connections", "private"] }),

  S("brand.wordmarkText", "website", "App name text (replaces the Nargito name image)", "string", "", { help: "Optional. Type a name here to show it as text, in the same style and size, instead of the name image. Leave empty to keep the image." }),
  S("brand.tagline", "website", "Tagline", "string", "Connect. Share. Discover."),
  S("brand.footerText", "website", "Footer text", "text", "Nargito helps people and businesses connect, travel and trade locally."),
  S("brand.metaKeywords", "website", "Meta keywords", "string", "social network, trips, marketplace, local business"),
  S("social.twitter", "website", "X / Twitter URL", "string", ""),
  S("social.facebook", "website", "Facebook URL", "string", ""),
  S("social.instagram", "website", "Instagram URL", "string", ""),
  S("social.linkedin", "website", "LinkedIn URL", "string", ""),
  S("social.youtube", "website", "YouTube URL", "string", ""),

  S("announcement.enabled", "website", "Show platform announcement", "boolean", false),
  S("announcement.title", "website", "Announcement title", "string", ""),
  S("announcement.body", "website", "Announcement text", "text", ""),
  S("announcement.link", "website", "Announcement link", "string", ""),

  S("maintenance.enabled", "maintenance", "Maintenance mode", "boolean", false, { sensitive: true }),
  S("maintenance.title", "maintenance", "Maintenance page title", "string", "We'll be right back"),
  S("maintenance.message", "maintenance", "Maintenance message", "text", "Nargito is undergoing scheduled maintenance. Please check back shortly."),

  S("upload.enabled", "uploads", "Uploads enabled", "boolean", true, { help: "Emergency switch: turn off to reject every upload." }),
  S("upload.maxImageMb", "uploads", "Max image size (MB)", "number", 8, { min: 1, max: 50 }),
  S("upload.maxVideoMb", "uploads", "Max video size (MB)", "number", 12, { min: 1, max: 500, help: "Server action limit is 12 MB; direct uploads use /api/uploads." }),
  S("upload.maxDocMb", "uploads", "Max document size (MB)", "number", 10, { min: 1, max: 50 }),
  S("upload.allowedImageTypes", "uploads", "Allowed image types", "list", ["image/jpeg", "image/png", "image/webp", "image/gif"]),
  S("upload.allowedVideoTypes", "uploads", "Allowed video types", "list", ["video/mp4", "video/webm"]),
  S("upload.allowedDocTypes", "uploads", "Allowed document types", "list", ["application/pdf"]),
  S("upload.maxFilesPerPost", "uploads", "Max files per post", "number", 6, { min: 1, max: 20 }),
  S("upload.thumbnails", "uploads", "Generate thumbnails", "boolean", true),
  S("upload.imageMaxDimension", "uploads", "Max image dimension (px)", "number", 2400, { min: 400, max: 6000 }),
  S("upload.dailyQuotaMb", "uploads", "Per-user daily upload quota (MB)", "number", 200, { min: 1, max: 10000 }),

  S("mail.provider", "email_sms", "Email provider", "select", "none", { options: ["none", "smtp", "resend"], help: "Credentials: SMTP_HOST/PORT/USER/PASS or RESEND_API_KEY." }),
  S("mail.fromName", "email_sms", "Sender name", "string", "Nargito"),
  S("mail.fromAddress", "email_sms", "Sender address", "string", "no-reply@nargito.example"),
  S("sms.provider", "email_sms", "SMS provider", "select", "none", { options: ["none", "twilio"], help: "Credentials: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM." }),
  S("otp.expiryMinutes", "email_sms", "OTP / link expiry (minutes)", "number", 15, { min: 3, max: 120 }),
  S("otp.maxAttempts", "email_sms", "Max OTP attempts", "number", 5, { min: 3, max: 10 }),
  S("otp.rateLimitPerHour", "email_sms", "OTP requests per hour per account", "number", 6, { min: 1, max: 30 }),

  S("chat.enabled", "chat", "Messaging enabled", "boolean", true),
  S("chat.allowAttachments", "chat", "Allow attachments", "boolean", true),
  S("chat.maxMessageLength", "chat", "Max message length", "number", 2000, { min: 100, max: 10000 }),
  S("chat.retentionDays", "chat", "Message retention (days, 0 = forever)", "number", 0, { min: 0, max: 3650 }),
  S("chat.presenceEnabled", "chat", "Presence (last seen / online)", "boolean", true),
  S("chat.callsEnabled", "chat", "Voice/video calls", "boolean", false, { help: "Not implemented in this release; cannot be enabled." }),

  S("oauth.google.enabled", "social", "Enable Google sign-in", "boolean", false),
  S("oauth.facebook.enabled", "social", "Enable Facebook sign-in", "boolean", false),
  S("oauth.autoLinkVerifiedEmail", "social", "Link to existing account when provider email is verified", "boolean", false, { sensitive: true, help: "Unverified provider emails are never linked automatically." }),

  S("realtime.pollIntervalMs", "runtime", "Message polling interval (ms)", "number", 4000, { min: 1500, max: 30000 }),
  S("worker.enabled", "runtime", "Background worker expected", "boolean", true),
  S("runtime.maxRequestsPerMinute", "runtime", "API requests per minute per client", "number", 240, { min: 30, max: 5000 }),

  S("ai.enabled", "ai", "Enable AI features", "boolean", false, { help: "Has no effect until AI_API_KEY is configured." }),
  S("ai.provider", "ai", "Provider", "select", "none", { options: ["none", "openai", "anthropic"] }),
  S("ai.model", "ai", "Model", "string", ""),
  S("ai.moderationAssist", "ai", "Moderation assistance", "boolean", false),
  S("ai.requestsPerDay", "ai", "Request limit per day", "number", 500, { min: 0, max: 100000 }),
  S("ai.monthlyBudgetUsd", "ai", "Monthly budget (USD)", "number", 0, { min: 0, max: 100000 }),

  S("pwa.name", "pwa", "App name", "string", "Nargito"),
  S("pwa.shortName", "pwa", "Short name", "string", "Nargito"),
  S("pwa.themeColor", "pwa", "Theme color", "color", "#1250F5"),
  S("pwa.backgroundColor", "pwa", "Background color", "color", "#F7F9FF"),
  S("pwa.startUrl", "pwa", "Start URL", "string", "/home"),
  S("pwa.display", "pwa", "Display mode", "select", "standalone", { options: ["standalone", "minimal-ui", "browser", "fullscreen"] }),
  S("pwa.installPrompt", "pwa", "Show install prompt", "boolean", true),
  S("pwa.offlineFallback", "pwa", "Offline fallback page", "boolean", true),

  S("mobile.deepLinks", "mobile", "Deep links (PWA scope handling)", "boolean", true),
  S("mobile.playStoreUrl", "mobile", "Google Play URL", "string", "", { help: "Leave empty unless a native app is published." }),
  S("mobile.appStoreUrl", "mobile", "App Store URL", "string", "", { help: "Leave empty unless a native app is published." }),

  S("posts.maxLength", "posts", "Max post length", "number", 3000, { min: 100, max: 20000 }),
  S("posts.maxMediaPerPost", "posts", "Max media per post", "number", 6, { min: 1, max: 20 }),
  S("posts.allowVideo", "posts", "Allow video", "boolean", true),
  S("posts.allowDocuments", "posts", "Allow documents", "boolean", true),
  S("posts.allowPolls", "posts", "Allow polls", "boolean", true),
  S("posts.defaultVisibility", "posts", "Default visibility", "select", "public", { options: ["public", "connections", "private"] }),
  S("posts.commentsEnabledByDefault", "posts", "Comments on by default", "boolean", true),
  S("posts.maxCommentLength", "posts", "Max comment length", "number", 1000, { min: 50, max: 5000 }),
  S("posts.rateLimitPerHour", "posts", "Posts per hour per user", "number", 20, { min: 1, max: 200 }),
  S("posts.draftRetentionDays", "posts", "Draft retention (days)", "number", 90, { min: 1, max: 3650 }),
  S("feed.pageSize", "posts", "Feed page size", "number", 10, { min: 5, max: 50 }),
  S("feed.sponsoredEvery", "posts", "Show a sponsored item every N posts (0 = off)", "number", 6, { min: 0, max: 30 }),

  S("design.primary", "design", "Primary color", "color", "#1250F5"),
  S("design.primaryHover", "design", "Primary hover color", "color", "#0A3ED2"),
  S("design.tint", "design", "Light tint", "color", "#EBF1FF"),
  S("design.radius", "design", "Corner radius (px)", "number", 16, { min: 0, max: 24 }),
  S("design.defaultTheme", "design", "Default theme", "select", "light", { options: ["light", "dark", "system"] }),
  S("design.customCss", "design", "Custom CSS (sanitised, no @import/url())", "text", "", { sensitive: true }),

  S("seo.titleTemplate", "seo", "Title template", "string", "%s | Nargito"),
  S("seo.defaultDescription", "seo", "Default description", "text", "Nargito - social networking, trips and local marketplace."),
  S("seo.allowIndexing", "seo", "Allow search engines to index public pages", "boolean", true, { sensitive: true }),
  S("seo.ogImage", "seo", "Default social image path", "string", "/icons/icon-512.png"),

  S("ads.enabled", "ads", "Advertising enabled", "boolean", true),
  S("ads.allowedTypes", "ads", "Eligible content types", "list", ["post", "product", "service", "shop", "company", "trip"]),
  S("ads.requireApproval", "ads", "Require admin approval", "boolean", true),
  S("ads.maxActivePerUser", "ads", "Max active promotions per user", "number", 5, { min: 1, max: 100 }),

  S("pro.enabled", "pro", "Pro membership available", "boolean", true),
  S("payments.provider", "pro", "Payment provider", "select", "none", { options: ["none", "stripe"], help: "Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." }),

  S("location.enabled", "location", "Nearby discovery enabled", "boolean", true),
  S("location.cellSizeKm", "location", "Coarse location cell size (km)", "number", 10, { min: 5, max: 100, help: "Coordinates are rounded to this grid; precise values are never stored." }),
];

export const SETTING_MAP = new Map(SETTINGS.map((s) => [s.key, s]));
