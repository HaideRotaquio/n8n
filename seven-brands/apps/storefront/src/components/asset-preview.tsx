import { renderAnimatedSvg, serialize, type AssetDefinition } from "@sb/asset";

/**
 * Animated preview. The markup comes from our renderer and a schema-validated definition
 * (fixed element and attribute names, escaped values), never from user input.
 */
export function AssetPreview({ ad, playOn = "load", className = "" }: { ad: AssetDefinition; playOn?: "load" | "hover"; className?: string }) {
  const svg = serialize(renderAnimatedSvg(ad, { playOn, title: true }));
  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-[var(--radius)] bg-[var(--color-surface)] p-6 [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
