/**
 * Server-side data of the home page: ONE read of the public offer cards in
 * "top-rated" order (the highest site rating first, `listPromotionCards`: explicit
 * column list, no affiliate URL, no commission) feeds the featured lists of both
 * segments, the hero spotlight, the ending soon block, the effort examples, the
 * counter and the "Aktualizacja" date.
 *
 * The home page NEVER uses the "Polecane" order (owner, 2026-11-11): that order is
 * only offered as a sort option on the /promocje list. Here the cards go by the
 * rating shown on each of them (scale 0-10, "Ocena serwisu").
 * The v1 page ran about eleven queries for the same content.
 *
 * `cache()` de-duplicates within one request: `generateMetadata` and the page
 * both need the model, the database is read once.
 *
 * A database failure must not turn the home page into a 500: the loader
 * returns `null` and the page renders its static content (hero, trust, FAQ)
 * with a short notice in place of the offers.
 */
import { cache } from "react";
import { listPromotionCards } from "@/lib/services/promotionCards";
import { readHomeModel, type HomeModel } from "./homeModel";

export const loadHomeModel = cache(
  (): Promise<HomeModel | null> => readHomeModel(() => listPromotionCards({ sort: "top-rated" }), new Date())
);
