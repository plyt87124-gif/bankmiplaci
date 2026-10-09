import { redirect } from "next/navigation";

/** /blog/kategoria has no content of its own; the categories are listed on /blog. */
export default function BlogCategoryIndex() {
  redirect("/blog");
}
