import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { StatusPill } from "@/components/admin/badges";
import { formatDateTime, isUuid } from "@/components/admin/format";
import { KeyValues, Panel, tableLink } from "@/components/admin/layout-bits";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Email" };

interface NotificationDetail {
  id: string;
  user_id: string;
  filing_id: string | null;
  business_id: string | null;
  template_key: string;
  channel: string;
  to_address: string;
  subject: string;
  body_text: string;
  body_html: string;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error: string | null;
  dedupe_key: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export default async function NotificationDetailPage(props: PageProps<"/admin/notifications/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const db = await createClient();
  const { data } = await db.from("notifications").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const n = data as NotificationDetail;

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Link href="/admin/notifications" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden />
        Emails
      </Link>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{n.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusPill status={n.status} />
          <span>
            To {n.to_address} · {formatDateTime(n.created_at)}
          </span>
        </div>
      </div>

      {n.provider === "outbox" ? (
        <Notice tone="info">Recorded by the outbox provider. This email was not delivered.</Notice>
      ) : null}
      {n.error ? (
        <Notice tone="danger" title="Delivery error">
          {n.error}
        </Notice>
      ) : null}

      <Panel title="Details">
        <KeyValues
          items={[
            { term: "Template", value: <span className="font-mono text-xs">{n.template_key}</span> },
            { term: "Channel", value: n.channel },
            { term: "Provider", value: n.provider ?? "None" },
            { term: "Provider message ID", value: n.provider_message_id ? <span className="font-mono text-xs break-all">{n.provider_message_id}</span> : "None" },
            { term: "Sent", value: n.sent_at ? formatDateTime(n.sent_at) : "Not sent" },
            { term: "Clicked", value: n.clicked_at ? formatDateTime(n.clicked_at) : "Not clicked" },
            { term: "Dedupe key", value: n.dedupe_key ? <span className="font-mono text-xs break-all">{n.dedupe_key}</span> : "None" },
            {
              term: "Filing",
              value: n.filing_id ? (
                <Link className={tableLink} href={`/admin/filings/${n.filing_id}`}>
                  Open the order
                </Link>
              ) : (
                "None"
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="HTML version" description="Rendered in a sandbox with scripts and links disabled." bodyClassName="p-0">
        <iframe
          title={`HTML version of the email "${n.subject}"`}
          sandbox=""
          srcDoc={n.body_html}
          className="block h-[40rem] w-full rounded-b-[var(--radius-surface)] bg-white"
        />
      </Panel>

      <Panel title="Text version">
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-fg">{n.body_text}</pre>
      </Panel>
    </div>
  );
}
