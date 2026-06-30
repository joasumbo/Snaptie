import { requestUpload } from "@/app/upload-actions";
import type { UploadKind, UploadTicket } from "@/lib/storage";

type Uploader = (input: {
  kind: UploadKind;
  contentType: string;
  size: number;
}) => Promise<UploadTicket>;

// Uploads a single file to R2 and returns its public URL. The upload is only
// performed when called (typically on form submit), so picking a file just
// shows a local preview and nothing is stored until the user confirms.
export async function uploadFile(
  file: File,
  kind: UploadKind,
  uploader?: Uploader,
): Promise<string> {
  const ticket = await (uploader ?? requestUpload)({
    kind,
    contentType: file.type,
    size: file.size,
  });
  if (!ticket.ok) throw new Error(ticket.message);

  const res = await fetch(ticket.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) {
    throw new Error("Falha no upload. Verifique a configuração de CORS do R2.");
  }
  return ticket.publicUrl;
}
