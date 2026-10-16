import {
  pgTable, text, uuid, timestamp, boolean, integer, jsonb, numeric, primaryKey, uniqueIndex, index, date,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────── Identity & access ───────────── */
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: ts("email_verified_at"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  headline: text("headline"),
  bio: text("bio"),
  locationLabel: text("location_label"),
  geoCell: text("geo_cell"), // coarse grid cell only - never precise coordinates
  website: text("website"),
  skills: text("skills").array().notNull().default([]),
  resume: jsonb("resume").$type<{ kind: "experience" | "education" | "certification" | "file"; title: string; org: string; from: string; to: string; description: string }[]>().notNull().default([]),
  accountType: text("account_type").notNull().default("personal"), // personal | business
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  profileVisibility: text("profile_visibility").notNull().default("public"), // public | connections | private
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactVisibility: text("contact_visibility").notNull().default("private"), // private | connections | public
  status: text("status").notNull().default("active"), // active | restricted | suspended | banned
  statusReason: text("status_reason"),
  restrictedUntil: ts("restricted_until"),
  verified: boolean("verified").notNull().default(false),
  locale: text("locale").notNull().default("en"),
  theme: text("theme").notNull().default("system"),
  locationSharing: boolean("location_sharing").notNull().default(false),
  discoverable: boolean("discoverable").notNull().default(true),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  lastSeenAt: ts("last_seen_at"),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
}, (t) => [index("users_created_idx").on(t.createdAt), index("users_status_idx").on(t.status)]);

export const authAccounts = pgTable("auth_accounts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("auth_provider_uq").on(t.provider, t.providerAccountId)]);

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  lastUsedAt: ts("last_used_at").defaultNow(),
  revokedAt: ts("revoked_at"),
  stepUpAt: ts("step_up_at"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const verificationTokens = pgTable("verification_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // email_verify | password_reset
  tokenHash: text("token_hash").notNull(),
  codeHash: text("code_hash"), // 6-digit OTP (hashed)
  attempts: integer("attempts").notNull().default(0),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
}, (t) => [index("vt_user_idx").on(t.userId, t.type)]);

export const roles = pgTable("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAt(),
});
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description"),
  groupName: text("group_name"),
});
export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })]);
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  grantedBy: uuid("granted_by"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] })]);
export const userPermissionOverrides = pgTable("user_permission_overrides", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  allow: boolean("allow").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.permissionKey] })]);

/* ───────────── Relationships ───────────── */
export const follows = pgTable("follows", {
  followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followingId] }), index("follows_following_idx").on(t.followingId)]);

export const connections = pgTable("connections", {
  id: id(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pairKey: text("pair_key").notNull(), // sorted "a:b" - guarantees one row per pair
  status: text("status").notNull().default("pending"), // pending | accepted
  createdAt: createdAt(),
  respondedAt: ts("responded_at"),
}, (t) => [uniqueIndex("connections_pair_uq").on(t.pairKey), index("connections_addr_idx").on(t.addresseeId, t.status)]);

export const blocks = pgTable("blocks", {
  blockerId: uuid("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]);

export const mutes = pgTable("mutes", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mutedUserId: uuid("muted_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.mutedUserId] })]);

/* generic follow for companies / shops / groups-lite */
export const entityFollows = pgTable("entity_follows", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.entityType, t.entityId] })]);

/* ───────────── Media ───────────── */
export const media = pgTable("media", {
  id: id(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // image | video | document
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  thumbPath: text("thumb_path"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  status: text("status").notNull().default("ready"), // ready | failed
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("media_owner_idx").on(t.ownerId)]);

/* ───────────── Categories ───────────── */
export const categories = pgTable("categories", {
  id: id(),
  type: text("type").notNull(), // product | service | trip | company | shop | group
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (t) => [uniqueIndex("categories_uq").on(t.type, t.slug)]);

/* ───────────── Businesses ───────────── */
export const companies = pgTable("companies", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline"),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  industry: text("industry"),
  website: text("website"),
  publicEmail: text("public_email"),
  publicPhone: text("public_phone"),
  locationLabel: text("location_label"),
  geoCell: text("geo_cell"),
  verified: boolean("verified").notNull().default(false),
  status: text("status").notNull().default("active"), // active | hidden | removed
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("companies_owner_idx").on(t.ownerId)]);

export const companyMembers = pgTable("company_members", {
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("editor"), // owner | admin | editor | viewer
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.companyId, t.userId] })]);

export const shops = pgTable("shops", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  category: text("category"),
  serviceArea: text("service_area"),
  locationLabel: text("location_label"),
  geoCell: text("geo_cell"),
  hours: text("hours"),
  contactPreference: text("contact_preference").notNull().default("enquiry"),
  verified: boolean("verified").notNull().default(false),
  status: text("status").notNull().default("active"),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("shops_owner_idx").on(t.ownerId)]);

export const shopMembers = pgTable("shop_members", {
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("editor"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.shopId, t.userId] })]);

export const products = pgTable("products", {
  id: id(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  shopId: uuid("shop_id").references(() => shops.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  price: numeric("price", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("INR"),
  condition: text("condition"), // new | like_new | used
  availability: text("availability").notNull().default("in_stock"),
  locationLabel: text("location_label"),
  geoCell: text("geo_cell"),
  images: text("images").array().notNull().default([]),
  status: text("status").notNull().default("active"), // draft | active | sold | archived | removed
  viewCount: integer("view_count").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("products_seller_idx").on(t.sellerId), index("products_status_idx").on(t.status, t.createdAt)]);

export const services = pgTable("services", {
  id: id(),
  providerId: uuid("provider_id").notNull().references(() => users.id),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  serviceArea: text("service_area"),
  pricingModel: text("pricing_model").notNull().default("fixed"), // fixed | hourly | quote
  startingPrice: numeric("starting_price", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("INR"),
  availability: text("availability"),
  locationLabel: text("location_label"),
  geoCell: text("geo_cell"),
  images: text("images").array().notNull().default([]),
  status: text("status").notNull().default("active"),
  viewCount: integer("view_count").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("services_provider_idx").on(t.providerId), index("services_status_idx").on(t.status, t.createdAt)]);

export const listingStatusHistory = pgTable("listing_status_history", {
  id: id(),
  listingType: text("listing_type").notNull(),
  listingId: uuid("listing_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: uuid("changed_by"),
  createdAt: createdAt(),
});

/* ───────────── Trips ───────────── */
export const trips = pgTable("trips", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  originArea: text("origin_area"),
  destination: text("destination").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  category: text("category"),
  budgetMin: numeric("budget_min", { precision: 12, scale: 2 }),
  budgetMax: numeric("budget_max", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("INR"),
  visibility: text("visibility").notNull().default("public"), // public | connections | private
  slots: integer("slots"),
  requireApproval: boolean("require_approval").notNull().default(true),
  preferences: text("preferences"),
  status: text("status").notNull().default("draft"), // draft | published | completed | cancelled | removed
  geoCell: text("geo_cell"),
  viewCount: integer("view_count").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("trips_owner_idx").on(t.ownerId), index("trips_status_idx").on(t.status, t.startDate)]);

export const tripItinerary = pgTable("trip_itinerary_items", {
  id: id(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  day: integer("day").notNull().default(1),
  title: text("title").notNull(),
  details: text("details"),
  isPrivate: boolean("is_private").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const tripParticipants = pgTable("trip_participants", {
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | approved | declined
  message: text("message"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.tripId, t.userId] })]);

/* ───────────── Groups ───────────── */
export const groups = pgTable("groups", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverUrl: text("cover_url"),
  category: text("category"),
  visibility: text("visibility").notNull().default("public"), // public | private
  status: text("status").notNull().default("active"),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
});
export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | moderator | member
  status: text("status").notNull().default("active"), // active | pending
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.groupId, t.userId] })]);

/* ───────────── Posts ───────────── */
export const posts = pgTable("posts", {
  id: id(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  shopId: uuid("shop_id").references(() => shops.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  type: text("type").notNull().default("text"), // text | image | video | link | document | trip | product | service | announcement | poll
  body: text("body").notNull().default(""),
  visibility: text("visibility").notNull().default("public"), // public | connections | private
  status: text("status").notNull().default("published"), // draft | published | removed
  commentsEnabled: boolean("comments_enabled").notNull().default(true),
  linkUrl: text("link_url"),
  linkTitle: text("link_title"),
  linkDescription: text("link_description"),
  linkImage: text("link_image"),
  refType: text("ref_type"),
  refId: uuid("ref_id"),
  sharedPostId: uuid("shared_post_id"),
  pollOptions: jsonb("poll_options").$type<string[] | null>(),
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  editedAt: ts("edited_at"),
  deletedAt: ts("deleted_at"),
}, (t) => [
  index("posts_feed_idx").on(t.status, t.visibility, t.createdAt),
  index("posts_author_idx").on(t.authorId, t.createdAt),
  index("posts_group_idx").on(t.groupId),
]);

export const postMedia = pgTable("post_media", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.postId, t.mediaId] })]);

export const pollVotes = pgTable("poll_votes", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  optionIndex: integer("option_index").notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const postReactions = pgTable("post_reactions", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("like"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const comments = pgTable("comments", {
  id: id(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  body: text("body").notNull(),
  status: text("status").notNull().default("published"), // published | removed
  createdAt: createdAt(),
  editedAt: ts("edited_at"),
}, (t) => [index("comments_post_idx").on(t.postId, t.createdAt)]);

export const savedItems = pgTable("saved_items", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // post | trip | product | service | company | shop | group
  entityId: uuid("entity_id").notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.entityType, t.entityId] })]);

export const entityViews = pgTable("entity_views", {
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  viewerKey: text("viewer_key").notNull(),
  day: date("day").notNull(),
}, (t) => [primaryKey({ columns: [t.entityType, t.entityId, t.viewerKey, t.day] })]);

/* ───────────── Moderation ───────────── */
export const reports = pgTable("reports", {
  id: id(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  status: text("status").notNull().default("open"), // open | reviewing | resolved | dismissed | appealed
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  reviewNotes: text("review_notes"),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
}, (t) => [index("reports_status_idx").on(t.status, t.createdAt)]);

export const reportActions = pgTable("report_actions", {
  id: id(),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const verificationRequests = pgTable("verification_requests", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("user"), // user | company | shop
  entityId: uuid("entity_id"),
  evidenceMediaIds: uuid("evidence_media_ids").array().notNull().default([]),
  note: text("note"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | more_info
  reasonCode: text("reason_code"),
  reviewerNote: text("reviewer_note"),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  decidedAt: ts("decided_at"),
  createdAt: createdAt(),
});

export const adminNotes = pgTable("admin_notes", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Messaging ───────────── */
export const conversations = pgTable("conversations", {
  id: id(),
  pairKey: text("pair_key").notNull(),
  contextKey: text("context_key").notNull().default(""), // "<listingType>:<listingId>" or ""
  lastMessageAt: ts("last_message_at").defaultNow(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("conversations_uq").on(t.pairKey, t.contextKey)]);

export const conversationParticipants = pgTable("conversation_participants", {
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: ts("last_read_at"),
  muted: boolean("muted").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("cp_user_idx").on(t.userId)]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("text"), // text | image | file | system
  body: text("body").notNull().default(""),
  attachmentId: uuid("attachment_id").references(() => media.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  deletedAt: ts("deleted_at"),
}, (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)]);

export const enquiries = pgTable("enquiries", {
  id: id(),
  listingType: text("listing_type").notNull(), // product | service | trip | company | shop
  listingId: uuid("listing_id").notNull(),
  titleSnapshot: text("title_snapshot").notNull(),
  imageSnapshot: text("image_snapshot"),
  enquirerId: uuid("enquirer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("new"), // new | responded | closed
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("enquiries_uq").on(t.listingType, t.listingId, t.enquirerId), index("enquiries_recipient_idx").on(t.recipientId, t.status)]);

/* ───────────── Notifications ───────────── */
export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  dedupeKey: text("dedupe_key"),
  readAt: ts("read_at"),
  createdAt: createdAt(),
}, (t) => [index("notif_user_idx").on(t.userId, t.createdAt), uniqueIndex("notif_dedupe_uq").on(t.userId, t.dedupeKey)]);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  channel: text("channel").notNull(), // in_app | email | sms | push
  enabled: boolean("enabled").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.type, t.channel] })]);

export const recentSearches = pgTable("recent_searches", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Monetisation ───────────── */
export const promotions = pgTable("promotions", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // post | product | service | shop | company | trip
  entityId: uuid("entity_id").notNull(),
  title: text("title").notNull(),
  placement: text("placement").notNull().default("feed"), // feed | sidebar
  audienceLocation: text("audience_location"),
  budgetCents: integer("budget_cents").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  status: text("status").notNull().default("pending"), // pending | active | paused | ended | rejected | suspended
  rejectionReason: text("rejection_reason"),
  createdAt: createdAt(),
}, (t) => [index("promotions_status_idx").on(t.status, t.placement)]);

export const promotionEvents = pgTable("promotion_events", {
  id: id(),
  promotionId: uuid("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // impression | click
  viewerKey: text("viewer_key").notNull(),
  day: date("day").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("promo_event_uq").on(t.promotionId, t.type, t.viewerKey, t.day)]);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  interval: text("interval").notNull().default("month"),
  features: text("features").array().notNull().default([]), // entitlement keys
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});
export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("active"), // active | cancelled | expired | past_due
  provider: text("provider"),
  providerRef: text("provider_ref"),
  startedAt: createdAt(),
  expiresAt: ts("expires_at"),
  cancelledAt: ts("cancelled_at"),
});
export const payments = pgTable("payments", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(), // succeeded | failed | refunded | partially_refunded
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("payments_provider_uq").on(t.provider, t.providerRef)]);
export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("requested"), // requested | approved | rejected | processed
  reason: text("reason"),
  decidedBy: uuid("decided_by"),
  createdAt: createdAt(),
  processedAt: ts("processed_at"),
});
export const billingEvents = pgTable("billing_events", {
  id: id(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  type: text("type").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("billing_events_uq").on(t.provider, t.eventId)]);

/* ───────────── Admin & configuration ───────────── */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  critical: boolean("critical").notNull().default(false),
  description: text("description"),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});
export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  fallback: text("fallback"),
});
export const translations = pgTable("translations", {
  id: id(),
  locale: text("locale").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (t) => [uniqueIndex("translations_uq").on(t.locale, t.key)]);

export const cmsPages = pgTable("cms_pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("published"), // draft | published
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  noindex: boolean("noindex").notNull().default(false),
  isLegal: boolean("is_legal").notNull().default(false),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});
export const cmsRevisions = pgTable("cms_page_revisions", {
  id: id(),
  pageId: uuid("page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});
export const redirects = pgTable("redirects", {
  id: id(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  permanent: boolean("permanent").notNull().default(true),
  hits: integer("hits").notNull().default(0),
  createdAt: createdAt(),
});
export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: createdAt(),
});

export const auditLogs = pgTable("admin_audit_logs", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => [index("audit_created_idx").on(t.createdAt)]);
export const securityEvents = pgTable("security_events", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index("secev_created_idx").on(t.createdAt)]);
export const systemLogs = pgTable("system_logs", {
  id: id(),
  level: text("level").notNull(), // debug | info | warn | error
  category: text("category").notNull(), // app | api | job | mail | storage
  component: text("component").notNull(),
  message: text("message").notNull(),
  correlationId: text("correlation_id"),
  userId: uuid("user_id"),
  status: integer("status"),
  durationMs: integer("duration_ms"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index("syslog_created_idx").on(t.createdAt), index("syslog_level_idx").on(t.level)]);
export const scheduledJobs = pgTable("scheduled_jobs", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  enabled: boolean("enabled").notNull().default(true),
  safeManual: boolean("safe_manual").notNull().default(true),
  retries: integer("retries").notNull().default(1),
  lastRunAt: ts("last_run_at"),
  nextRunAt: ts("next_run_at"),
  lastStatus: text("last_status"),
  lastDurationMs: integer("last_duration_ms"),
  lastError: text("last_error"),
});
export const adminApprovals = pgTable("admin_action_approvals", {
  id: id(),
  action: text("action").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | executed
  createdAt: createdAt(),
  decidedAt: ts("decided_at"),
});
export const dataRequests = pgTable("data_requests", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // export | deletion
  status: text("status").notNull().default("pending"), // pending | processing | done | rejected
  resultPath: text("result_path"),
  createdAt: createdAt(),
  processedAt: ts("processed_at"),
});
export const emailLog = pgTable("email_log", {
  id: id(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  kind: text("kind").notNull().default("email"), // email | sms
  status: text("status").notNull(), // sent | skipped | failed
  provider: text("provider"),
  error: text("error"),
  createdAt: createdAt(),
});

