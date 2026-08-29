import { BluenteApiError } from "./errors.js";

// Base64 rides inside the model's context window, so this is a last resort for
// tiny files only; anything larger must use the upload URL or a public link.
export const MAX_BASE64_FILE_BYTES = 2 * 1024 * 1024;

const isFilled = (value) => typeof value === "string" && value.trim().length > 0;

function decodeBase64File(fileBase64) {
  // Models routinely emit base64url and drop padding; normalize both so atob
  // does not reject otherwise-valid content.
  const normalized = fileBase64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const compact = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  // Cheap encoded-length gate before decoding megabytes of rejected input.
  if (compact.length > Math.ceil(MAX_BASE64_FILE_BYTES / 3) * 4 + 4) {
    throw new BluenteApiError(
      "file_content_base64 exceeds the 2MB decoded limit. Use file_path or file_url instead.",
      { maxBytes: MAX_BASE64_FILE_BYTES }
    );
  }

  let binary;
  try {
    binary = atob(compact);
  } catch {
    throw new BluenteApiError("file_content_base64 is not valid base64.");
  }

  if (binary.length > MAX_BASE64_FILE_BYTES) {
    throw new BluenteApiError(
      "file_content_base64 exceeds the 2MB decoded limit. Use file_path or file_url instead.",
      { maxBytes: MAX_BASE64_FILE_BYTES, decodedBytes: binary.length }
    );
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function resolveToolFileSource(args) {
  const fileUrl = args.file_to_translate?.download_url || args.file_url;
  const filePath = args.file_path;
  const fileBase64 = args.file_content_base64;
  // A local path carries its own name; without this the confirmation card
  // would show the document as "uploaded file".
  const fileName =
    args.file_name || args.file_to_translate?.file_name || filePath?.split(/[\\/]/).pop();

  if (!isFilled(fileUrl) && !isFilled(filePath) && !isFilled(fileBase64)) {
    throw new BluenteApiError(
      "Missing source file. Provide file_path for a file on this machine, or file_to_translate.download_url / file_url for a publicly accessible link."
    );
  }

  const useBase64 = !isFilled(fileUrl) && !isFilled(filePath) && isFilled(fileBase64);

  return {
    fileUrl: isFilled(fileUrl) ? fileUrl.trim() : undefined,
    filePath: isFilled(filePath) ? filePath.trim() : undefined,
    fileBuffer: useBase64 ? decodeBase64File(fileBase64) : undefined,
    fileName
  };
}
