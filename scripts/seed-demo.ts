import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { schema } from "../src/server/db";
import type { Db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { pairKey } from "../src/server/util";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@12345";
export const MODERATOR = { email: "moderator@nargito.local", password: process.env.SEED_MODERATOR_PASSWORD ?? "Moderator@2026" };

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? ".data/uploads");
const ago = (h: number) => new Date(Date.now() - h * 3600_000);
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

/** Rich, clearly-flagged demo data (is_seed = true) so every screen can be tried straight away. */
export async function seedDemo(db: Db) {
  // illustrations -> media table so posts can use real uploaded-style media
  const artDir = path.resolve("public", "art");
  mkdirSync(path.join(UPLOAD_ROOT, "art"), { recursive: true });
  const art: Record<string, string> = {};

  const pw = await hashPassword(DEMO_PASSWORD);
  const P: [string, string, string, string, string | null][] = [
    // username, name, headline, location, cover art
    ["demo", "Demo Member", "Product designer and weekend trekker", "Pune, India", "trek"],
    ["aarav_sharma", "Aarav Sharma", "Travel photographer | Himalayas", "Delhi, India", "guide"],
    ["meera_iyer", "Meera Iyer", "Product designer at a Bengaluru startup", "Bengaluru, India", "laptop"],
    ["rohan_mehta", "Rohan Mehta", "Owner, Mehta Cycles", "Pune, India", "cycle"],
    ["priya_nair", "Priya Nair", "Yoga teacher and wellness coach", "Kochi, India", "wellness"],
    ["kabir_singh", "Kabir Singh", "Mountain guide and trek organiser", "Manali, India", "trek"],
    ["ananya_rao", "Ananya Rao", "Home baker | Custom cakes", "Hyderabad, India", "bakery"],
    ["vikram_desai", "Vikram Desai", "Full-stack developer, open-source fan", "Ahmedabad, India", "laptop"],
    ["sara_khan", "Sara Khan", "Travel writer and food explorer", "Jaipur, India", "jaipur"],
  ];
  const U: Record<string, string> = {};
  for (const [username, displayName, headline, loc, cover] of P) {
    const email = username === "demo" ? "demo@nargito.local" : `${username}@nargito.demo`;
    const [u] = await db.insert(schema.users).values({
      email, username, displayName, headline, locationLabel: loc, passwordHash: pw, emailVerifiedAt: new Date(), onboardingDone: true, isSeed: true,
      bio: `${displayName} on Nargito. Sharing ${headline.toLowerCase()}.`, skills: ["Travel", "Community", "Photography"].slice(0, 2 + (username.length % 2)),
      coverUrl: cover ? `/art/${cover}.jpg` : null, verified: ["aarav_sharma", "rohan_mehta", "kabir_singh"].includes(username), lastSeenAt: ago(username.length % 5),
    }).returning({ id: schema.users.id });
    U[username] = u!.id;
  }

  // moderator login
  const [mod] = await db.insert(schema.users).values({ email: MODERATOR.email, username: "nargito_mod", displayName: "Nargito Moderator", headline: "Community moderator", passwordHash: await hashPassword(MODERATOR.password), emailVerifiedAt: new Date(), onboardingDone: true, verified: true, discoverable: false, isSeed: true }).returning();
  const [modRole] = await db.select().from(schema.roles).where(eq(schema.roles.name, "moderator"));
  if (modRole) await db.insert(schema.userRoles).values({ userId: mod!.id, roleId: modRole.id });

  // media rows for the illustrations and supplied photos (so posts can attach real media)
  const imagesDir = path.resolve("public", "images");
  mkdirSync(path.join(UPLOAD_ROOT, "art"), { recursive: true });
  for (const [dir, label] of [[artDir, "illustration"], [imagesDir, "photo"]] as const) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".jpg"))) {
      copyFileSync(path.join(dir, f), path.join(UPLOAD_ROOT, "art", f));
      const name = f.replace(".jpg", "");
      const [m] = await db.insert(schema.media).values({ ownerId: U["demo"]!, kind: "image", mime: "image/jpeg", size: statSync(path.join(dir, f)).size, path: `art/${f}`, width: 1200, height: 800, alt: `${name.replace(/-/g, " ")} ${label}` }).returning({ id: schema.media.id });
      art[name] = m!.id;
    }
  }
  // names with a hyphen are the supplied photos in public/images; the rest are illustrations in public/art
  const A = (n: string) => (n.includes("-") ? `/images/${n}.jpg` : `/art/${n}.jpg`);

  // relationships
  const follow = (a: string, b: string) => db.insert(schema.follows).values({ followerId: U[a]!, followingId: U[b]! }).onConflictDoNothing();
  for (const x of ["aarav_sharma", "meera_iyer", "rohan_mehta", "kabir_singh", "ananya_rao"]) await follow("demo", x);
  for (const x of ["aarav_sharma", "meera_iyer", "kabir_singh", "priya_nair", "sara_khan", "vikram_desai"]) await follow(x, "demo");
  for (const x of ["meera_iyer", "kabir_singh", "priya_nair", "sara_khan", "vikram_desai", "ananya_rao"]) await follow(x, "aarav_sharma");
  const conn = (a: string, b: string, status: "accepted" | "pending") => db.insert(schema.connections).values({ requesterId: U[a]!, addresseeId: U[b]!, pairKey: pairKey(U[a]!, U[b]!), status, respondedAt: status === "accepted" ? ago(48) : null });
  await conn("demo", "aarav_sharma", "accepted"); await conn("meera_iyer", "demo", "accepted"); await conn("demo", "kabir_singh", "accepted");
  await conn("vikram_desai", "demo", "pending"); await conn("demo", "sara_khan", "pending");

  // businesses
  const [mehta] = await db.insert(schema.companies).values({ ownerId: U["rohan_mehta"]!, name: "Mehta Cycles", slug: "mehta-cycles", tagline: "Bikes, service and trail gear since 1998", description: "Family-run cycle store serving Pune for over twenty years. We sell, service and rent road, hybrid and mountain bikes, and run weekend group rides.", industry: "Retail", locationLabel: "Pune, India", website: "https://example.com", publicEmail: "hello@mehtacycles.example", publicPhone: "+91 20 5555 0101", logoUrl: A("cycle"), coverUrl: A("cycle"), verified: true, isSeed: true }).returning();
  const [trail] = await db.insert(schema.companies).values({ ownerId: U["kabir_singh"]!, name: "TrailCraft Adventures", slug: "trailcraft-adventures", tagline: "Safety-first treks across the Himalayas", description: "Certified guides, small groups and honest itineraries. We organise treks in Kullu, Spiti and Uttarakhand.", industry: "Travel", locationLabel: "Manali, India", logoUrl: A("guide"), coverUrl: A("trek"), verified: true, isSeed: true }).returning();
  const [pixel] = await db.insert(schema.companies).values({ ownerId: U["vikram_desai"]!, name: "Pixel & Co Studio", slug: "pixel-and-co", tagline: "Fast, accessible websites for small businesses", description: "A two-person studio building accessible, fast websites and web apps.", industry: "Technology", locationLabel: "Ahmedabad, India", logoUrl: A("laptop"), coverUrl: A("keyboard"), isSeed: true }).returning();
  for (const [c, u] of [[mehta, "rohan_mehta"], [trail, "kabir_singh"], [pixel, "vikram_desai"]] as const) await db.insert(schema.companyMembers).values({ companyId: c!.id, userId: U[u]!, role: "owner" });
  await db.insert(schema.companyMembers).values({ companyId: mehta!.id, userId: U["demo"]!, role: "editor" });
  const [bake] = await db.insert(schema.shops).values({ ownerId: U["ananya_rao"]!, name: "Ananya's Bakehouse", slug: "ananyas-bakehouse", description: "Custom cakes, cookies and festive hampers baked to order in small batches. Eggless options available. We create sweet moments for every occasion.", category: "Food & Drink", locationLabel: "Hyderabad, India", serviceArea: "Serves Hyderabad and nearby areas", hours: "Mon - Sat: 9:00 AM - 8:00 PM\nSun: By appointment", logoUrl: A("shop-bakery-avatar"), coverUrl: A("shop-bakery-cover"), verified: true, isSeed: true }).returning();
  const [bikeShop] = await db.insert(schema.shops).values({ ownerId: U["rohan_mehta"]!, companyId: mehta!.id, name: "Mehta Cycles Store", slug: "mehta-cycles-store", description: "Bikes, helmets, lights and spares. Walk in or enquire online.", category: "Sports & Outdoors", locationLabel: "Pune, India", hours: "Daily 10:00-20:00", logoUrl: A("cycle"), coverUrl: A("cycle"), verified: true, isSeed: true }).returning();
  await db.insert(schema.shopMembers).values([{ shopId: bake!.id, userId: U["ananya_rao"]!, role: "owner" }, { shopId: bikeShop!.id, userId: U["rohan_mehta"]!, role: "owner" }]);

  // products
  const products: [string, string, string, number, string, string, string, string, string | null, string | null][] = [
    ["rohan_mehta", "Trail mountain bike, 21 speed", "Aluminium frame, front suspension and disc brakes. One careful owner, fully serviced. Includes mudguards and a bottle cage.", 18500, "Sports & Outdoors", "used", "cycle", "Pune, India", bikeShop!.id, mehta!.id],
    ["rohan_mehta", "Certified cycling helmet (M/L)", "Lightweight ventilated helmet with adjustable fit. New with tags.", 1499, "Sports & Outdoors", "new", "cycle", "Pune, India", bikeShop!.id, mehta!.id],
    ["ananya_rao", "Festive cookie hamper", "Box of 24 assorted cookies in a reusable tin. Order two days ahead.", 899, "Food & Groceries", "new", "product-festive-cookie-hamper", "Hyderabad, India", bake!.id, null],
    ["ananya_rao", "Custom birthday cake, 1 kg", "Pick a flavour and a message. Eggless on request. Pickup in Hyderabad.", 1250, "Food & Groceries", "new", "product-custom-birthday-cake", "Hyderabad, India", bake!.id, null],
    ["ananya_rao", "Chocolate truffle cake", "Rich dark chocolate sponge layered with truffle ganache. Eggless on request.", 1250, "Food & Groceries", "new", "product-chocolate-truffle-cake", "Hyderabad, India", bake!.id, null],
    ["vikram_desai", "Mechanical keyboard, hot-swap", "75% layout, tactile switches, USB-C. Barely used.", 5200, "Electronics", "like_new", "keyboard", "Ahmedabad, India", null, null],
    ["aarav_sharma", "Signed print: Himalayan sunrise (A3)", "Limited run of 30, signed and numbered. Ships rolled in a tube.", 2400, "Handmade", "new", "print", "Delhi, India", null, null],
    ["aarav_sharma", "Vintage film camera with leather case", "Fully working 35mm rangefinder, recently serviced.", 6800, "Electronics", "used", "camera", "Delhi, India", null, null],
    ["meera_iyer", "Laptop stand, aluminium", "Foldable stand for desks. Great for video calls.", 1100, "Electronics", "new", "laptop", "Bengaluru, India", null, null],
  ];
  const PR: Record<string, string> = {};
  for (const [owner, title, description, price, category, condition, img, loc, shopId, companyId] of products) {
    const [p] = await db.insert(schema.products).values({ sellerId: U[owner]!, title, description, price: String(price), category, condition, locationLabel: loc, images: [A(img)], shopId, companyId, viewCount: 20 + (title.length % 40), isSeed: true, createdAt: ago(10 + (title.length % 50)) }).returning({ id: schema.products.id });
    PR[title] = p!.id;
  }
  const services: [string, string, string, string, string, string, number | null, string][] = [
    ["aarav_sharma", "Travel photography sessions", "Half-day and full-day shoots at destinations across North India. Edited gallery delivered in a week.", "Photography", "Delhi NCR and Himachal", "fixed", 6000, "camera"],
    ["priya_nair", "Private yoga and breathwork", "One-to-one or small group sessions at home, outdoors or online.", "Health & Wellness", "Kochi and online", "hourly", 800, "wellness"],
    ["kabir_singh", "Guided treks in the Kullu valley", "Safety-certified guide, permits arranged, gear checklist included.", "Travel & Guides", "Manali and Kullu", "quote", null, "guide"],
    ["vikram_desai", "Websites for small businesses", "Fast, accessible websites with ongoing support.", "Design & Creative", "Remote", "quote", null, "laptop"],
    ["meera_iyer", "Product design consulting", "UX audits, design sprints and portfolio reviews.", "Design & Creative", "Remote", "hourly", 2500, "keyboard"],
  ];
  for (const [owner, title, description, category, area, model, price, img] of services) {
    await db.insert(schema.services).values({ providerId: U[owner]!, companyId: owner === "kabir_singh" ? trail!.id : owner === "vikram_desai" ? pixel!.id : null, title, description, category, serviceArea: area, pricingModel: model, startingPrice: price ? String(price) : null, locationLabel: area, images: [A(img)], viewCount: 10 + (title.length % 30), isSeed: true });
  }

  // trips
  const [t1] = await db.insert(schema.trips).values({ ownerId: U["kabir_singh"]!, title: "Hampta Pass trek: 5 days", description: "A moderate crossing from Manali to Chandratal with camping under the stars. Good for first-time trekkers with decent fitness. Meals, permits and guides included.", coverUrl: A("trip-manali"), originArea: "Manali", destination: "Hampta Pass, Himachal Pradesh", startDate: inDays(30), endDate: inDays(35), category: "Adventure", budgetMin: "14000", budgetMax: "18000", slots: 8, status: "published", visibility: "public", preferences: "Moderate fitness. Carry your own water bottle and layers.", viewCount: 64, isSeed: true }).returning();
  await db.insert(schema.tripItinerary).values([
    { tripId: t1!.id, day: 1, title: "Manali to Jobra", details: "Drive to the trailhead and trek to Jobra camp.", position: 0 },
    { tripId: t1!.id, day: 2, title: "Jobra to Jwara", details: "Gentle ascent through alpine meadows.", position: 1 },
    { tripId: t1!.id, day: 3, title: "Hampta Pass crossing", details: "Summit day. Early start at 5 am.", position: 2 },
    { tripId: t1!.id, day: 4, title: "Chandratal lake", details: "Exact campsite coordinates and emergency contacts shared with confirmed participants.", position: 3, isPrivate: true },
  ]);
  await db.insert(schema.tripParticipants).values([{ tripId: t1!.id, userId: U["aarav_sharma"]!, status: "approved" }, { tripId: t1!.id, userId: U["meera_iyer"]!, status: "approved" }, { tripId: t1!.id, userId: U["sara_khan"]!, status: "pending", message: "Done a few Himalayan treks, would love to join!" }]);
  const [t2] = await db.insert(schema.trips).values({ ownerId: U["sara_khan"]!, title: "Jaipur food walk weekend", description: "Two days of kachori, lassi, step-wells and old-city lanes with a local writer.", coverUrl: A("jaipur"), originArea: "Delhi", destination: "Jaipur, Rajasthan", startDate: inDays(14), endDate: inDays(16), category: "Culture", slots: 6, status: "published", viewCount: 41, isSeed: true }).returning();
  const tripRows: [string, string, string, string, string, string, number, number, number][] = [
    // owner, title, description, cover, destination, category, startInDays, lengthDays, slots
    ["kabir_singh", "Spiti Valley Road Trip", "A thrilling road trip through high mountain passes, monasteries and raw landscapes.", "trip-spiti-valley", "Himachal Pradesh", "Road trip", 2, 8, 8],
    ["sara_khan", "Goa Weekend Getaway", "Sun, beach, good food and great company for a relaxing weekend.", "trip-goa", "Goa", "Beach", 12, 2, 12],
    ["priya_nair", "Rishikesh Yoga & Adventure", "Yoga, rafting, cafes and peaceful Himalayan vibes.", "trip-rishikesh", "Uttarakhand", "Spiritual", 17, 2, 10],
    ["aarav_sharma", "Kashmir Great Lakes", "Experience pristine alpine lakes and breathtaking mountain views.", "trip-kashmir-great-lakes", "Jammu & Kashmir", "Trekking", 30, 5, 6],
    ["kabir_singh", "Manali Explorer", "Pine forests, riverside cafes and an easy hill-station escape.", "trip-manali", "Himachal Pradesh", "Hill station", 40, 4, 9],
    ["kabir_singh", "Leh Ladakh Expedition", "High passes, turquoise lakes and monasteries on a classic Ladakh circuit.", "trip-leh-ladakh", "Ladakh", "Adventure", 45, 7, 10],
    ["sara_khan", "Udaipur Heritage Trip", "Palaces, lakeside sunsets and old-city lanes with a local writer.", "trip-udaipur", "Rajasthan", "Culture", 50, 3, 8],
    ["aarav_sharma", "Valley of Flowers", "A gentle monsoon trek through meadows in full bloom.", "trip-valley-of-flowers", "Uttarakhand", "Trekking", 60, 6, 7],
    ["priya_nair", "Andaman Island Escape", "Clear water, white sand and snorkelling stops across the islands.", "trip-andaman", "Andaman & Nicobar", "Beach", 70, 6, 10],
    ["sara_khan", "Gokarna Beach Hopping", "Quiet beaches, sunset cliffs and fresh seafood on the Karnataka coast.", "trip-gokarna", "Karnataka", "Beach", 75, 4, 12],
    ["aarav_sharma", "Haridwar Ganga Aarti Weekend", "Evening aarti, riverside walks and a slow weekend by the Ganga.", "trip-haridwar", "Uttarakhand", "Spiritual", 80, 2, 10],
    ["kabir_singh", "Tawang Monastery Circuit", "Mountain monasteries and high passes in Arunachal Pradesh.", "trip-tawang", "Arunachal Pradesh", "Culture", 90, 6, 8],
  ];
  for (const [owner, title, description, cover, destination, category, start, len, slots] of tripRows) {
    await db.insert(schema.trips).values({ ownerId: U[owner]!, title, description, coverUrl: A(cover), originArea: "Delhi", destination, startDate: inDays(start), endDate: inDays(start + len), category, slots, status: "published", visibility: "public", viewCount: 10 + (title.length % 40), isSeed: true });
  }
  await db.insert(schema.trips).values([
    { ownerId: U["aarav_sharma"]!, title: "Goa sunrise photography retreat", description: "Four mornings, four beaches, one portfolio. All skill levels welcome.", coverUrl: A("beach"), originArea: "Mumbai", destination: "South Goa", startDate: inDays(52), endDate: inDays(56), category: "Beach", slots: 10, status: "published", viewCount: 22, isSeed: true },
    { ownerId: U["demo"]!, title: "Weekend cycling loop: Pune to Lavasa", description: "A scenic 70 km ride with a chai stop and a support vehicle. Bring your own bike or rent one from Mehta Cycles.", coverUrl: A("cycle"), originArea: "Pune", destination: "Lavasa, Maharashtra", startDate: inDays(9), endDate: inDays(9), category: "Road trip", slots: 12, status: "published", viewCount: 15, isSeed: true },
  ]);

  // groups
  const [g1] = await db.insert(schema.groups).values({ ownerId: U["aarav_sharma"]!, name: "Himalayan Travellers", slug: "himalayan-travellers", description: "Plans, permits and photographs from the mountains.", category: "Travel", coverUrl: A("guide"), isSeed: true }).returning();
  const [g2] = await db.insert(schema.groups).values({ ownerId: U["meera_iyer"]!, name: "Design Circle India", slug: "design-circle-india", description: "Designers sharing critiques, jobs and resources.", category: "Learning", coverUrl: A("community"), isSeed: true }).returning();
  await db.insert(schema.groups).values({ ownerId: U["ananya_rao"]!, name: "Home Bakers Hyderabad", slug: "home-bakers-hyderabad", description: "Recipes, sourcing and orders for local home bakers.", category: "Food", coverUrl: A("food"), isSeed: true });
  await db.insert(schema.groupMembers).values([{ groupId: g1!.id, userId: U["aarav_sharma"]!, role: "owner" }, { groupId: g1!.id, userId: U["demo"]!, role: "member" }, { groupId: g1!.id, userId: U["kabir_singh"]!, role: "moderator" }, { groupId: g2!.id, userId: U["meera_iyer"]!, role: "owner" }, { groupId: g2!.id, userId: U["demo"]!, role: "member" }]);

  // posts
  const post = async (author: string, body: string, opts: { imgs?: string[]; type?: string; hoursAgo: number; refType?: string; refId?: string; companyId?: string; groupId?: string; poll?: string[]; shopId?: string }) => {
    const [p] = await db.insert(schema.posts).values({ authorId: U[author]!, body, type: opts.type ?? (opts.imgs?.length ? "image" : opts.poll ? "poll" : "text"), createdAt: ago(opts.hoursAgo), refType: opts.refType, refId: opts.refId, companyId: opts.companyId, groupId: opts.groupId, shopId: opts.shopId, pollOptions: opts.poll ?? null, isSeed: true }).returning({ id: schema.posts.id });
    for (const [i, n] of (opts.imgs ?? []).entries()) await db.insert(schema.postMedia).values({ postId: p!.id, mediaId: art[n]!, position: i });
    return p!.id;
  };
  const pAarav = await post("aarav_sharma", "First light over the Parvati valley this morning. Worth every step of the climb.", { imgs: ["hero-trips", "trip-spiti-valley", "trip-kashmir-great-lakes", "trip-valley-of-flowers", "trip-manali"], hoursAgo: 3 });
  const pKabir = await post("kabir_singh", "Spots are open for the Hampta Pass trek next month. Small group, certified guides, honest itinerary. Details on the trip page.", { hoursAgo: 5, type: "trip", refType: "trip", refId: t1!.id });
  await post("rohan_mehta", "Just restocked helmets, lights and spares at the store. Come by this weekend and we'll fit you for free.", { hoursAgo: 7, companyId: mehta!.id, type: "announcement", imgs: ["cycle"] });
  await post("meera_iyer", "Tip for small teams: write the problem statement before you open the design tool. It saves a week of rework.", { hoursAgo: 9 });
  await post("sara_khan", "Best kachori in the old city? I have a shortlist of five, tell me yours before the food walk.", { hoursAgo: 12, imgs: ["jaipur"] });
  await post("ananya_rao", "New festive hampers are live in the shop this week. Eggless options too.", { hoursAgo: 15, shopId: bake!.id, type: "announcement", imgs: ["update-strawberry-cake", "update-gift-hamper", "product-festive-cookie-hamper"] });
  await post("vikram_desai", "Shipped accessibility fixes to our checkout flow today. Keyboard users, you were on my mind.", { hoursAgo: 20 });
  await post("priya_nair", "Which would you rather join this month?", { hoursAgo: 26, poll: ["Sunrise yoga at the beach", "Evening breathwork online", "Weekend wellness retreat"] });
  await post("aarav_sharma", "Selling my signed Himalayan sunrise prints. Limited run of thirty. Link in the listing.", { hoursAgo: 30, type: "product", refType: "product", refId: PR["Signed print: Himalayan sunrise (A3)"]!, imgs: ["print"] });
  await post("demo", "Planning a relaxed cycling loop from Pune to Lavasa. Anyone keen? It is 70 km with a chai stop halfway.", { hoursAgo: 34, imgs: ["cycle"] });
  await post("aarav_sharma", "Golden hour in the old city is unbeatable. Heading out with the camera again tomorrow.", { hoursAgo: 40, groupId: g1!.id });
  await post("meera_iyer", "Sharing a checklist I use for design critiques: goal, audience, constraint, next step. Happy to swap notes.", { hoursAgo: 46, groupId: g2!.id });
  await post("kabir_singh", "Before any trek: break in your boots, pack layers, and tell someone your route. Mountains reward preparation.", { hoursAgo: 52, imgs: ["guide"] });
  await post("sara_khan", "Booked the guesthouse for the Jaipur weekend. Four slots left on the food walk.", { hoursAgo: 60, type: "trip", refType: "trip", refId: t2!.id });
  void pAarav; void pKabir;

  // a few comments and likes (counters are reconciled below)
  const allPosts = await db.select({ id: schema.posts.id, author: schema.posts.authorId }).from(schema.posts);
  const commenters = ["demo", "meera_iyer", "kabir_singh", "aarav_sharma", "sara_khan", "priya_nair"];
  const lines = ["Love this!", "This is exactly what I needed today.", "Count me in.", "Beautiful shot.", "Thanks for sharing, saving this.", "Great tip."];
  for (const [i, p] of allPosts.entries()) {
    for (let k = 0; k < (i % 4); k++) await db.insert(schema.comments).values({ postId: p.id, authorId: U[commenters[(i + k) % commenters.length]!]!, body: lines[(i + k) % lines.length]!, createdAt: ago(1 + k) });
    for (const [j, c] of commenters.entries()) if ((i + j) % 2 === 0 && U[c] !== p.author) await db.insert(schema.postReactions).values({ postId: p.id, userId: U[c]! }).onConflictDoNothing();
  }
  await db.execute(sql`UPDATE posts p SET like_count = (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id), comment_count = (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published')`);

  // saved + entity follows
  await db.insert(schema.savedItems).values([{ userId: U["demo"]!, entityType: "trip", entityId: t1!.id }, { userId: U["demo"]!, entityType: "product", entityId: PR["Vintage film camera with leather case"]! }]).onConflictDoNothing();
  await db.insert(schema.entityFollows).values([{ userId: U["demo"]!, entityType: "shop", entityId: bake!.id }, { userId: U["demo"]!, entityType: "company", entityId: trail!.id }]).onConflictDoNothing();

  // conversations: an enquiry (unread reply) and a direct chat
  const key = `product:${PR["Trail mountain bike, 21 speed"]}`;
  const [c1] = await db.insert(schema.conversations).values({ pairKey: pairKey(U["demo"]!, U["rohan_mehta"]!), contextKey: key, lastMessageAt: ago(1) }).returning();
  await db.insert(schema.conversationParticipants).values([{ conversationId: c1!.id, userId: U["demo"]!, lastReadAt: ago(3) }, { conversationId: c1!.id, userId: U["rohan_mehta"]!, lastReadAt: ago(1) }]);
  await db.insert(schema.messages).values([
    { conversationId: c1!.id, senderId: U["demo"]!, body: "Hi Rohan, is the trail bike still available this weekend?", createdAt: ago(5) },
    { conversationId: c1!.id, senderId: U["rohan_mehta"]!, body: "Hello! Yes it is. Would you like to come for a test ride on Saturday morning?", createdAt: ago(4) },
    { conversationId: c1!.id, senderId: U["demo"]!, body: "That works. What time suits you?", createdAt: ago(3) },
    { conversationId: c1!.id, senderId: U["rohan_mehta"]!, body: "10 am at the store. I'll have it serviced and ready. Bring an ID for the ride.", createdAt: ago(1) },
  ]);
  await db.insert(schema.enquiries).values({ listingType: "product", listingId: PR["Trail mountain bike, 21 speed"]!, titleSnapshot: "Trail mountain bike, 21 speed", imageSnapshot: A("cycle"), enquirerId: U["demo"]!, recipientId: U["rohan_mehta"]!, conversationId: c1!.id, status: "responded" });
  const [c2] = await db.insert(schema.conversations).values({ pairKey: pairKey(U["demo"]!, U["meera_iyer"]!), contextKey: "", lastMessageAt: ago(2) }).returning();
  await db.insert(schema.conversationParticipants).values([{ conversationId: c2!.id, userId: U["demo"]!, lastReadAt: ago(8) }, { conversationId: c2!.id, userId: U["meera_iyer"]!, lastReadAt: ago(2) }]);
  await db.insert(schema.messages).values([{ conversationId: c2!.id, senderId: U["meera_iyer"]!, body: "Hey! Are you joining the Hampta Pass trek?", createdAt: ago(6) }, { conversationId: c2!.id, senderId: U["meera_iyer"]!, body: "I just got confirmed. Would be great to travel together.", createdAt: ago(2) }]);
  // an enquiry received by a seller account (so sellers see an inbox too)
  const [c3] = await db.insert(schema.conversations).values({ pairKey: pairKey(U["sara_khan"]!, U["aarav_sharma"]!), contextKey: "", lastMessageAt: ago(20) }).returning();
  await db.insert(schema.conversationParticipants).values([{ conversationId: c3!.id, userId: U["sara_khan"]!, lastReadAt: ago(19) }, { conversationId: c3!.id, userId: U["aarav_sharma"]!, lastReadAt: ago(40) }]);
  await db.insert(schema.messages).values({ conversationId: c3!.id, senderId: U["sara_khan"]!, body: "Hi Aarav, do you do travel shoots in Jaipur?", createdAt: ago(20) });

  // notifications for the demo member
  await db.insert(schema.notifications).values([
    { userId: U["demo"]!, type: "connection", actorId: U["vikram_desai"]!, title: "New connection request", link: "/connections", createdAt: ago(2) },
    { userId: U["demo"]!, type: "reaction", actorId: U["aarav_sharma"]!, title: "Someone liked your post", body: "Planning a relaxed cycling loop from Pune to Lavasa.", link: "/my/posts", createdAt: ago(3) },
    { userId: U["demo"]!, type: "comment", actorId: U["meera_iyer"]!, title: "New comment on your post", body: "Count me in.", link: "/my/posts", createdAt: ago(4) },
    { userId: U["demo"]!, type: "enquiry", actorId: U["rohan_mehta"]!, title: "Rohan replied to your enquiry", body: "10 am at the store. I'll have it serviced and ready.", link: `/messages/${c1!.id}`, createdAt: ago(1) },
    { userId: U["demo"]!, type: "business", actorId: U["ananya_rao"]!, title: "New update from Ananya's Bakehouse", link: "/shops/ananyas-bakehouse", readAt: ago(5), createdAt: ago(15) },
  ]);

  // sponsored placements (approved demo promotions)
  const until = new Date(Date.now() + 30 * 86400_000);
  await db.insert(schema.promotions).values([
    { ownerId: U["rohan_mehta"]!, entityType: "product", entityId: PR["Trail mountain bike, 21 speed"]!, title: "Trail mountain bike, fully serviced", placement: "feed", status: "active", startsAt: ago(24), endsAt: until },
    { ownerId: U["kabir_singh"]!, entityType: "trip", entityId: t1!.id, title: "Hampta Pass trek: join the next batch", placement: "sidebar", status: "active", startsAt: ago(24), endsAt: until },
  ]);

  return { users: P.length + 1 };
}
