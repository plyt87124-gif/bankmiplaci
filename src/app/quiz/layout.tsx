import type { Metadata } from "next";

// quiz/page.tsx is a Client Component and can't export `metadata` itself —
// this thin server layout supplies it without touching the quiz logic.
export const metadata: Metadata = {
  title: "Quiz — dopasuj promocję bankową do siebie",
  description:
    "Odpowiedz na 5 krótkich pytań o to, ile pracy chcesz włożyć i jakie masz możliwości — pokażemy Ci 3 promocje bankowe najlepiej dopasowane do Twoich potrzeb.",
  alternates: { canonical: "/quiz" }
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
