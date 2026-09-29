import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const DOCUMENT_BUCKET = "filing-documents";
/** Vercel caps function request bodies at 4.5 MB; state receipts are far smaller. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 60;

export type DocumentKind = "state_receipt" | "filed_report" | "acknowledgement" | "filing_packet" | "customer_upload" | "other";

/** Detect type from magic bytes — the client-supplied MIME type is not trusted. */
export function sniffMime(bytes: Uint8Array): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d)
    return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (cleaned || "document").slice(0, 120);
}

export class DocumentValidationError extends Error {}

/**
 * Store a document for a filing. Caller must already have authorized the actor
 * (e.g. requireStaff). Storage paths are unguessable and scoped by owner + filing.
 */
export async function storeFilingDocument(input: {
  filingId: string;
  ownerUserId: string;
  file: File;
  kind: DocumentKind;
  uploadedBy: string;
  visibleToCustomer: boolean;
}): Promise<{ id: string; storagePath: string; sha256: string }> {
  if (!(input.file instanceof File) || input.file.size === 0) throw new DocumentValidationError("Choose a file to upload");
  if (input.file.size > MAX_DOCUMENT_BYTES) throw new DocumentValidationError("Files must be 4 MB or smaller");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new DocumentValidationError("Only PDF, PNG and JPEG files are accepted");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = sanitizeFileName(input.file.name);
  const storagePath = `${input.ownerUserId}/${input.filingId}/${randomUUID()}-${fileName}`;
  const db = createAdminClient();

  const { error: uploadError } = await db.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error } = await db
    .from("filing_documents")
    .insert({
      filing_id: input.filingId,
      user_id: input.ownerUserId,
      kind: input.kind,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mime,
      size_bytes: bytes.length,
      sha256,
      visible_to_customer: input.visibleToCustomer,
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();
  if (error) {
    await db.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw new Error(`Document record failed: ${error.message}`);
  }
  return { id: data.id, storagePath, sha256 };
}

/**
 * Authorize via ROW-LEVEL SECURITY: the document row is read with the requesting
 * user's own client, so a customer can only resolve documents they own (and that
 * are visible to them); staff can resolve all. Only then is a short-lived signed
 * URL minted with the service role.
 */
export async function signedUrlForDocument(documentId: string): Promise<{ url: string; fileName: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return null;
  const userDb = await createClient();
  const { data: doc } = await userDb
    .from("filing_documents")
    .select("id, storage_bucket, storage_path, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return null;
  const { data, error } = await createAdminClient()
    .storage.from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, { download: doc.file_name });
  if (error || !data) return null;
  return { url: data.signedUrl, fileName: doc.file_name };
}
