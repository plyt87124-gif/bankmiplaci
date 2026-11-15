import type { Network } from "@/lib/affiliateNetworks";

/**
 * The name of an affiliate network the way the network writes it (owner, 2026-11-15: "wszystkie nazwy sieci
 * afiliacyjnych niech nabiorą ich oryginalnego stylu", after two logo screenshots):
 *
 *   eBroker partner   "eBroker" in dark navy, "partner" in blue, a plain geometric sans (the site's body face);
 *   comperia Lead     "comperia" in grey, heavy serif, all lowercase; "Lead" in light sky blue, thin sans; the logo
 *                     variant adds the small line "PROGRAM PARTNERSKI NR1" under it.
 *
 * Text, not a picture: it stays crisp, inherits the surrounding size (everything is in em), is copied and found as
 * the plain words, and follows the dark theme (the navy turns light there; the colours live in globals.css under
 * `.net-name`, as plain custom properties, not as design tokens). Used wherever a network's name is shown (the
 * /admin/prowizje tables, headings, buttons and help texts). The plain-text name for places that cannot show markup
 * (reports, notifications, option labels) stays `NETWORK_LABEL` in affiliateNetworks.ts.
 *
 *   inline  one line, for running text ("eBroker partner: CPS 450 zł", "panel comperia Lead")
 *   logo    larger and stacked like the logos: for the heading of a network's block
 */
export function NetworkName({ network, variant = "inline", className }: { network: Network; variant?: "inline" | "logo"; className?: string }) {
  const classes = ["net-name", `net-${network === "EBROKER" ? "ebroker" : "comperia"}`, variant === "logo" ? "net-logo" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  if (network === "EBROKER") {
    return (
      <span className={classes} data-network="EBROKER">
        <span className="net-main">eBroker</span>
        {variant === "logo" ? <br /> : " "}
        <span className="net-sub">partner</span>
      </span>
    );
  }
  return (
    <span className={classes} data-network="COMPERIA">
      <span className="net-main">Comperia</span>
      <span className="net-sub">Lead</span>
      {variant === "logo" && (
        <span className="net-tag" aria-hidden="true">
          Program <strong>partnerski</strong> nr1
        </span>
      )}
    </span>
  );
}
