/**
 * `rel` of every link that leaves for a bank through /out/...:
 *  - sponsored: it is a paid/affiliate link (Google's guidance),
 *  - nofollow: no ranking credit,
 *  - noopener noreferrer: the bank's page gets no handle on ours and no referrer.
 * Kept out of AffiliateCtaLink.tsx on purpose: that file is a client component,
 * and a server component importing a constant from it would receive a client
 * reference instead of the string.
 */
export const AFFILIATE_LINK_REL = "sponsored nofollow noopener noreferrer";
