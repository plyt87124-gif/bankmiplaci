/**
 * Database reads of the account hubs. Goes through listPromotionCards (explicit
 * column list, no affiliate URL, no commission), so nothing private can reach
 * the HTML. `cache()` de-duplicates inside one request: generateMetadata and
 * the page both need the cards.
 */
import { cache } from "react";
import { listPromotionCards, type PromotionCardData } from "@/lib/services/promotionCards";
import { selectHubCards, type HubKind } from "./hubs";

/** Every offer on the public list in the default "Polecane" order (one query for both hubs). */
const getAllCards = cache((): Promise<PromotionCardData[]> => listPromotionCards({ sort: "recommended" }));

/** The offers of one hub, in the default "Polecane" order. */
export async function getHubCards(kind: HubKind): Promise<PromotionCardData[]> {
  return selectHubCards(await getAllCards(), kind);
}
