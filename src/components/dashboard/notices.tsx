import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/surface";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Something went wrong with that request. Please try again.",
  not_found: "We couldn't find that business in your account.",
  start_not_found: "We couldn't find that business in your account.",
  start_unavailable: "We can't file this one for you yet. You can still file directly with the state.",
  start_not_allowed: "There's no open filing for this business right now.",
  start_invalid: "We couldn't start the filing. Please try again.",
  start_error: "We couldn't start the filing. Please try again.",
  already_handling: "We're already handling this filing for you, so it can't be marked as filed elsewhere.",
  mark_error: "We couldn't update that filing. Please try again.",
};

/** Confirmation and error notices driven by query parameters after a redirect. */
export function DashboardNotices({
  searchParams,
  addedMessage = "Business added. We'll remind you before it's due.",
  className,
}: {
  searchParams: SearchParams;
  addedMessage?: string;
  className?: string;
}) {
  const notices: { key: string; tone: "success" | "danger"; text: string }[] = [];
  if (first(searchParams.password) === "updated") {
    notices.push({ key: "password", tone: "success", text: "Your password was updated." });
  }
  if (first(searchParams.added) === "1") {
    notices.push({ key: "added", tone: "success", text: addedMessage });
  }
  if (first(searchParams.marked) === "1") {
    notices.push({
      key: "marked",
      tone: "success",
      text: "Marked as filed. Reminders for that period have stopped, and we'll track next year's report.",
    });
  }
  const error = first(searchParams.error);
  if (error) {
    notices.push({ key: "error", tone: "danger", text: ERROR_MESSAGES[error] ?? ERROR_MESSAGES.invalid });
  }
  if (notices.length === 0) return null;
  return (
    <div className={cn("grid gap-3", className)}>
      {notices.map((n) => (
        <Notice key={n.key} tone={n.tone} role={n.tone === "danger" ? "alert" : "status"} title={n.text} />
      ))}
    </div>
  );
}
