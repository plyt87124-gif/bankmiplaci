import { cn } from "@/lib/cn";

type Tone = "teal" | "gold" | "coral" | "neutral";

const tones: Record<Tone, string> = {
  teal: "bg-teal-100 text-teal-700",
  gold: "bg-gold-100 text-gold-600",
  coral: "bg-coral-100 text-coral-600",
  neutral: "bg-ink-100 text-ink-700"
};

export function Badge({
  tone = "neutral",
  className,
  children
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
