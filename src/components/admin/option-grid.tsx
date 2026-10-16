import Link from "next/link";
import {
  Activity, BarChart3, Bell, Building2, Bug, CheckSquare, Clock, CreditCard, Crown, DatabaseBackup, FileText, Flag, Globe, HeartPulse, Image as ImageIcon,
  KeyRound, Languages, LayoutDashboard, ListChecks, Mail, MapPin, Megaphone, MessageSquare, Monitor, Newspaper, Palette, Plane, Radio, ScrollText, Search,
  Settings, Shield, ShieldAlert, Siren, Smartphone, Sparkles, Store, Tag, ToggleRight, Undo2, Upload, UserCheck, Users, UsersRound, Wifi, Wrench, Package, Briefcase, BadgeCheck, Inbox, type LucideIcon,
} from "lucide-react";
import type { VisibleGroup } from "@/server/admin-nav";

const ICONS: Record<string, LucideIcon> = {
  "Dashboard": LayoutDashboard, "Analytics": BarChart3, "System health": HeartPulse,
  "Posts": FileText, "Trips": Plane, "Products": Package, "Services": Briefcase, "Companies": Building2, "Shops": Store, "Groups": UsersRound, "Categories": Tag,
  "Reports & moderation": Flag, "Pages & CMS": Newspaper,
  "Manage users": Users, "Online users": Wifi, "Verification": BadgeCheck, "Contact messages": Inbox,
  "Messaging": MessageSquare, "Notifications & announcements": Bell, "Email & SMS": Mail, "Realtime & runtime": Radio,
  "Advertising policy": Megaphone, "Promotions queue": ListChecks, "Pro configuration": Crown, "Pro features": Sparkles, "Pro members": UserCheck, "Pro payments": CreditCard, "Pro refunds": Undo2,
  "General": Settings, "Website information": Globe, "Logo & images": ImageIcon, "Manage features": ToggleRight, "Languages": Languages, "File uploads": Upload,
  "Social login": KeyRound, "AI": Sparkles, "PWA": Smartphone, "Mobile app": Smartphone, "Posts & feed": FileText, "Design & themes": Palette, "Location": MapPin,
  "SEO & redirects": Search, "Maintenance mode": Wrench,
  "System logs": ScrollText, "Audit logs": ScrollText, "Debugger & health": Bug, "Cron jobs": Clock, "Tools": Wrench, "Backup status": DatabaseBackup,
  "Roles & permissions": Shield, "Admin sessions": Monitor, "Security events": ShieldAlert, "Emergency controls": Siren, "Approvals": CheckSquare,
};

/** Phone/tablet dashboard: every admin option as a tappable tile, two per row. */
export function AdminOptionGrid({ groups }: { groups: VisibleGroup[] }) {
  const list = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/admin") })).filter((g) => g.items.length);
  return (
    <section aria-label="All admin options" className="lg:hidden">
      <h2 className="mb-1 mt-7 text-xl font-extrabold">All options</h2>
      <p className="mb-3 text-sm text-muted">Tap any tile to open it.</p>
      <div className="space-y-5">
        {list.map((g) => (
          <div key={g.label}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{g.label}</h3>
            <ul className="grid grid-cols-2 gap-3">
              {g.items.map((i) => {
                const Icon = ICONS[i.label] ?? Activity;
                return (
                  <li key={i.href}>
                    <Link href={i.href} className="card flex h-full min-h-[84px] flex-col items-start justify-between gap-2 p-3.5 transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary"><Icon size={18} aria-hidden /></span>
                      <span className="text-[13.5px] font-bold leading-snug">{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
