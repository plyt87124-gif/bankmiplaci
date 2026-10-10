import type { Metadata } from "next";

// The login page is a client component, so its metadata lives in this layout.
// /admin is Disallowed in robots.txt; this keeps the page out of the index
// even if it gets linked from somewhere.
export const metadata: Metadata = {
  title: "Logowanie administratora",
  robots: { index: false, follow: false }
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
