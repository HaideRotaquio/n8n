import type { AssetDefinition } from "@sb/asset";
import type { ReactNode } from "react";
import type { PreviewAsset } from "@/components/live-preview";

export interface CatalogItem {
  slug: string;
  title: string;
  kind: "single" | "pack";
  assetCount: number;
  /** "from $3.00", "Free", or null when not for sale. */
  priceLabel: string | null;
  isFree: boolean;
  cover: AssetDefinition | null;
  category: string | null;
  categoryLabel: string | null;
  /** Lowercased title, description and tags, for search. */
  searchText: string;
}

export interface ShellProps {
  brandName: string;
  tagline: string;
  signedIn: boolean;
  testMode: boolean;
  children: ReactNode;
}

export interface HomeProps {
  tagline: string;
  description: string;
  items: CatalogItem[];
  categories: { slug: string; label: string; count: number }[];
  q: string;
  category: string | null;
  freePack: CatalogItem | null;
  /** Hero showcase (first page load, unfiltered). */
  showcase: CatalogItem[];
}

export interface ProductProps {
  title: string;
  description: string;
  categoryLabel: string | null;
  assets: PreviewAsset[];
  buy: ReactNode;
  facts: { label: string; value: string }[];
  customizer: boolean;
}

export interface Design {
  Shell(props: ShellProps): ReactNode;
  Home(props: HomeProps): ReactNode;
  Product(props: ProductProps): ReactNode;
  /** Wrapper for help, account and auth pages. */
  Page(props: { title: string; intro?: string; children: ReactNode; narrow?: boolean }): ReactNode;
}
