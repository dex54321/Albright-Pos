import { Boxes, Layers, Hammer, Home, Droplet, Zap, PaintBucket, Wrench, TreePine, Cog, Package, type LucideIcon } from "lucide-react";

/**
 * One recognizable icon per product category, so a cashier can tell what
 * something is at a glance in the POS grid without a real photo of every
 * item. Matched to the category names the app seeds by default; anything
 * unrecognized (a custom category someone typed in) falls back to a plain
 * box icon rather than showing nothing.
 */
const MAP: Record<string, LucideIcon> = {
  "building materials": Boxes,
  "steel & metal": Layers,
  "nails & fasteners": Hammer,
  roofing: Home,
  plumbing: Droplet,
  electrical: Zap,
  "paint & finishing": PaintBucket,
  tools: Wrench,
  "timber & boards": TreePine,
  "general hardware": Cog,
};

export function getCategoryIcon(categoryName?: string | null): LucideIcon {
  if (!categoryName) return Package;
  return MAP[categoryName.trim().toLowerCase()] ?? Package;
}

/** A consistent, pleasant background tint per category (same hue family as the icon set), so tiles are easy to tell apart by color too. */
const COLORS: Record<string, string> = {
  "building materials": "#e2d6c3",
  "steel & metal": "#d6dde3",
  "nails & fasteners": "#e3d6c9",
  roofing: "#e0cfc0",
  plumbing: "#cfe0e8",
  electrical: "#f3e3b3",
  "paint & finishing": "#e8d3df",
  tools: "#d9dde0",
  "timber & boards": "#ddd0b8",
  "general hardware": "#dcdfe1",
};
export function getCategoryColor(categoryName?: string | null): string {
  if (!categoryName) return "#e4e7df";
  return COLORS[categoryName.trim().toLowerCase()] ?? "#e4e7df";
}
