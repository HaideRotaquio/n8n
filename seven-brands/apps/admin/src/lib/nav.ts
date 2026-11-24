import type { Permission } from "@sb/core";

/**
 * The 16 dashboard sections from the blueprint. `phase` marks when a section is built;
 * sections with a phase later than the current one render an honest "not built yet" page.
 */
export const CURRENT_PHASE = 2;

export interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  phase: number;
  description: string;
  /** "global": company-wide page, needs a global grant. Default: any brand. */
  scope?: "global";
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", permission: "overview.read", phase: 1, description: "Company-wide status." },
  { href: "/brands", label: "Brands", permission: "brand.read", phase: 1, description: "Brand identities, domains and status." },
  { href: "/assets", label: "Asset library", permission: "asset.read", phase: 2, description: "Versioned asset definitions, variants and exports." },
  { href: "/production", label: "Production factory", permission: "production.read", phase: 2, description: "Production jobs, batches and their costs." },
  { href: "/agents", label: "AI agents", permission: "production.read", phase: 2, description: "Agent runs, models, token usage and failures." },
  { href: "/quality", label: "Quality assurance", permission: "asset.review", phase: 2, description: "Automated QA results and the human review queue." },
  { href: "/catalog", label: "Product catalog", permission: "catalog.read", phase: 3, description: "Products, collections, bundles and prices." },
  { href: "/stores", label: "Store management", permission: "catalog.read", phase: 4, description: "Storefront content, navigation and merchandising." },
  { href: "/orders", label: "Orders", permission: "order.read", phase: 3, description: "Orders, payments and refunds (refunds need approval)." },
  { href: "/customers", label: "Customers", permission: "customer.read", phase: 3, description: "Brand-scoped customer records and privacy requests." },
  { href: "/licenses", label: "Licenses", permission: "license.read", phase: 3, description: "Issued licenses, verification and revocation." },
  { href: "/analytics", label: "Analytics", permission: "analytics.read", phase: 4, description: "Traffic, conversion and channel performance per brand." },
  { href: "/revenue", label: "Revenue", permission: "finance.read", phase: 3, description: "Gross, fees, tax and net revenue per brand." },
  { href: "/expenses", label: "Expenses", permission: "finance.read", phase: 2, description: "AI, infrastructure, payment and marketing costs.", scope: "global" },
  { href: "/infrastructure", label: "Infrastructure", permission: "infrastructure.read", phase: 1, description: "Service health and configuration checks.", scope: "global" },
  { href: "/team", label: "Team & roles", permission: "team.read", phase: 1, description: "Staff accounts and role assignments.", scope: "global" },
  { href: "/audit", label: "Audit log", permission: "audit.read", phase: 1, description: "Append-only record of administrative actions.", scope: "global" },
];

export function plannedSection(slug: string): NavItem | undefined {
  return NAV.find((n) => n.href === `/${slug}` && n.phase > CURRENT_PHASE);
}
