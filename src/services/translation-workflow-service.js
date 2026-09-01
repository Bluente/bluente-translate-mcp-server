import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { PRE_TRANSLATION_TERMINAL_STATUSES, TERMINAL_TRANSLATION_STATUSES } from "../constants/api.js";
import {
  clipBackendText,
  expandHome,
  safeFileName,
  toBilingualParam,
  toScannedParam
} from "../clients/bluente-http-client.js";
import { BluenteApiError } from "../lib/errors.js";
import { normalizeLanguageCode } from "../lib/language-codes.js";

// The confirm token ties a confirmed call to the card the user actually saw.
// notBefore is a heuristic: a model cannot have shown the card and received a
// reply within 20 s of minting, so an earlier confirmed call is a same-turn
// bypass, not a confirmation. It does not prove the user replied.
const CONFIRM_NOT_BEFORE_MS = 20_000;
const CONFIRM_TTL_MS = 15 * 60_000;
// ponytail: in-memory, process-local by design. This is a single-user STDIO
// server, so a Map is the whole store and tokens die with the process; move to
// the backend if the hosted server ever needs the same gate.
const confirmTokens = new Map();

// The settings the card displayed, in the canonical form the wire path sends
// (same helpers), so a confirm is compared by meaning, not spelling: "off" is
// "none", mode "standard" is scanned 0, "zh-CN" is "zh", page_range loses its
// whitespace. null means the card asked the user for it instead of showing it;
// a layout only counts when bilingual is on, since the card shows none otherwise.
function canonicalSettings({ from, to, toTypes, bilingual, layout, scanned, pageRange }) {
  const bilingualOn = bilingual === undefined || bilingual === null ? null : toBilingualParam(bilingual);
  return {
    from: from === undefined || from === null ? null : normalizeLanguageCode(from),
    to: to === undefined || to === null ? null : normalizeLanguageCode(to),
    to_type: toTypes.length ? [...toTypes].sort().join("+") : null,
    bilingual: bilingualOn,
    bilingual_layout: bilingualOn === 1 ? (layout ?? null) : null,
    mode: scanned === undefined || scanned === null ? null : toScannedParam(scanned),
    page_range: pageRange === undefined || pageRange === null ? null : String(pageRange).replace(/\s+/g, "")
  };
}

// A card line that read "(ask the user)" may be answered on the confirmed call
// without a new card, as long as the answer cannot change the quoted cost.
// mode is fillable only to standard, the default the card said it would use.
const FILLABLE_SETTINGS = new Set(["to_type", "bilingual", "bilingual_layout"]);
function settingsMatchCard(card, confirm) {
  return Object.keys(card).every((key) => {
    if (card[key] === confirm[key]) return true;
    if (card[key] !== null) return false;
    return FILLABLE_SETTINGS.has(key) || (key === "mode" && confirm[key] === 0);
  });
}

function mintConfirmToken({ taskId, settings, now }) {
  // A re-card for the same task supersedes any earlier card the user saw.
  for (const [token, entry] of confirmTokens) {
    if (entry.expires <= now || entry.taskId === String(taskId)) confirmTokens.delete(token);
  }
  const token = randomBytes(16).toString("hex");
  confirmTokens.set(token, {
    taskId: String(taskId),
    settings,
    notBefore: now + CONFIRM_NOT_BEFORE_MS,
    expires: now + CONFIRM_TTL_MS
  });
  return token;
}

// Throws unless the token was minted for this task with these settings and is
// old enough for a user to have replied. Returns commit(), which the caller
// runs once the start request has succeeded: a failed start leaves the token
// valid so the same confirmation can simply be retried (single-use on success).
function consumeConfirmToken({ token, taskId, settings, now }) {
  const entry = token ? confirmTokens.get(token) : undefined;
  if (!entry || entry.expires <= now) {
    confirmTokens.delete(token);
    throw new BluenteApiError(
      "confirmed=true requires a valid confirm_token: make the unconfirmed call first to get a confirmation card, show it to the user, and pass the returned confirm_token. Nothing was started."
    );
  }
  if (entry.taskId !== String(taskId)) {
    throw new BluenteApiError(
      "confirm_token was issued for a different task_id. Call again without confirmed to get a new confirmation card. Nothing was started."
    );
  }
  if (!settingsMatchCard(entry.settings, settings)) {
    throw new BluenteApiError(
      "settings changed since the confirmation card (a setting the card asked for may be filled in, but one it displayed must match); call again without confirmed to get a new card for the user to review. Nothing was started."
    );
  }
  if (now < entry.notBefore) {
    throw new BluenteApiError(
      "confirmation card was shown less than 20 seconds ago; wait for the user's reply, then call again with the same confirm_token. Nothing was started.",
      { retry_after_ms: entry.notBefore - now }
    );
  }
  return () => confirmTokens.delete(token);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `budget` is shared across both poll phases so max_poll_attempts bounds total wall clock,
// not each phase separately.
async function pollStatusUntilTerminal({ client, id, entry, terminalStatuses, pollIntervalMs, budget }) {
  let finalStatusPayload = null;

  while (budget.remaining > 0) {
    budget.remaining -= 1;
    finalStatusPayload = await client.getTranslationStatus({ id, entry });

    if (terminalStatuses.has(finalStatusPayload?.data?.status)) {
      break;
    }

    if (budget.remaining > 0) {
      await sleep(pollIntervalMs);
    }
  }

  return finalStatusPayload;
}


// The confirmation the model shows the user, composed server-side so every host
// renders the same summary instead of improvising one. Cost is quoted in pages
// (the backend owns credit pricing). Only image mode is charged above 1 credit
// per page: backend effectiveDeductPages multiplies it by 5 and leaves every
// other mode, both scanned modes included, at 1x.
// Mirrors the backend's ValidatePageRange: each part must be start>=1, end>=start,
// end<=pageCount. Throws so the confirmation card never prices an invalid range.
function assertValidPageRange(pageRange, pageCount) {
  for (const part of String(pageRange).split(",")) {
    const nums = part.trim().split("-");
    const start = Number.parseInt(nums[0], 10);
    const end = nums.length === 2 ? Number.parseInt(nums[1], 10) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end > pageCount) {
      throw new BluenteApiError(
        `page_range "${pageRange}" is not valid for this ${
          Number.isFinite(pageCount) ? `${pageCount}-page document` : "document"
        }.`,
        { page_range: pageRange, page_count: Number.isFinite(pageCount) ? pageCount : null }
      );
    }
  }
}

// The bilingual param is binary at heart; line/paragraph are legacy aliases for on.
function isBilingualOn(bilingual) {
  return bilingual === "on" || bilingual === "line" || bilingual === "paragraph";
}

function countRangePages(pageRange) {
  let total = 0;
  for (const part of String(pageRange).split(",")) {
    const nums = part.trim().split("-");
    const start = Number.parseInt(nums[0], 10);
    const end = nums.length === 2 ? Number.parseInt(nums[1], 10) : start;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      total += end - start + 1;
    }
  }
  return total;
}

function buildConfirmationSummary({ fileName, pageCount, from, to, toTypes, bilingual, bilingualLayout, scanned, pageRange }) {
  const formatLabels = { pdf: "PDF", word: "Word", pptx: "PowerPoint" };
  const layoutLabels = {
    "left-right": "Left-Right (original and translation side by side)",
    "top-down": "Top-Down (translation stacked under the original)"
  };
  const bilingualLabels = {
    off: "Off (clean translation)",
    none: "Off (clean translation)",
    on: "On (original text kept alongside the translation)",
    line: "On (original text kept alongside the translation)",
    paragraph: "On (original text kept alongside the translation)"
  };
  const modeLabels = {
    0: "Standard",
    standard: "Standard",
    none: "Standard",
    1: "Scanned — text (clean text-only document)",
    text: "Scanned — text (clean text-only document)",
    "scanned (text)": "Scanned — text (clean text-only document)",
    2: "Scanned — overlay (translation placed back in the original layout)",
    overlay: "Scanned — overlay (translation placed back in the original layout)",
    "scanned (overlay)": "Scanned — overlay (translation placed back in the original layout)",
    3: "Image (re-render a graphic in the target language; 5 credits per page)",
    image: "Image (re-render a graphic in the target language; 5 credits per page)"
  };
  // Server-authored static text (no interpolation, so fence-safe by construction).
  // A mode nobody chose must read as a decision, not a settled fact: rendering
  // "Mode: Standard" for a defaulted mode is what once sent a scanned contract
  // through standard. Only shown on the unconfirmed call, so the digital common
  // case pays nothing at translate time.
  const MODE_ASK_LINE =
    "Mode: (confirm — defaulted to Standard. If this document is a scan (its pages are images of text with no selectable text layer), choose 'scanned (overlay)' to keep the original layout with translation on top, or 'scanned (text)' for a clean OCR'd text document. Standard still OCRs a scan internally but is meant for digital files.)";
  const totalPages = pageCount ?? "unknown";
  const pages = pageRange ? countRangePages(pageRange) : totalPages;
  // Every free-string field is stripped of newlines: this card is wrapped in a
  // ``` fence the model is told to render verbatim, so a value containing
  // "\n```" (a document filename, or a prompt-injected from/to language code)
  // could otherwise close the fence and forge card lines the user would trust.
  // The filename comes from the document itself, so it also loses path parts,
  // control characters, and anything past 80 chars.
  const clean = (value) => String(value).replace(/[\r\n]+/g, " ");
  const documentName = safeFileName(fileName || "") || "uploaded file";
  const isImageMode = scanned === 3 || scanned === "image";
  // Backend effectiveDeductPages: image translation is charged pages x 5, and
  // every other mode -- both scanned modes included -- is charged pages x 1.
  const credits = isImageMode && typeof pages === "number" ? pages * 5 : pages;

  const lines = [
    `Document: ${documentName} (${totalPages} page${totalPages === 1 ? "" : "s"})`,
    `Languages: ${clean(from || "auto-detect")} \u2192 ${clean(to || "(ask the user)")}`,
    `Cost: ${credits} page${credits === 1 ? "" : "s"} of credit${
      isImageMode ? ` (image mode: 5 per page for ${pages} page${pages === 1 ? "" : "s"})` : ""
    }`,
    `Pages: ${pageRange ? `${clean(pageRange)} (${pages} of ${totalPages} pages)` : "All"}`,
    `Output: ${toTypes.length ? toTypes.map((t) => formatLabels[t] || t).join(" + ") : "(ask the user: PDF, Word, or PowerPoint)"}`,
    `Bilingual: ${bilingual === undefined || bilingual === null ? "(ask the user)" : bilingualLabels[bilingual] || clean(bilingual)}`,
    // The layout is a decision only when bilingual is on; an off (or still
    // unanswered) bilingual gets no layout line at all, so off pays no friction.
    ...(isBilingualOn(bilingual)
      ? [
          bilingualLayout === undefined || bilingualLayout === null
            ? "Bilingual layout: (confirm — Left-Right side by side, or Top-Down stacked)"
            : `Bilingual layout: ${layoutLabels[bilingualLayout] || clean(bilingualLayout)}`
        ]
      : []),
    // undefined means neither mode nor the deprecated scanned arg was passed:
    // that is a defaulted mode, rendered as an ask; an explicit value (even
    // "standard") renders the settled label.
    scanned === undefined || scanned === null ? MODE_ASK_LINE : `Mode: ${modeLabels[scanned] ?? "Standard"}`
  ];

  return lines.join("\n");
}

export class TranslationWorkflowService {
  // `now` is injectable so tests can move the confirm-token clock.
  constructor({ client, now = Date.now }) {
    this.client = client;
    this.now = now;
  }

  async runDocumentWorkflow({
    taskId,
    fileUrl,
    filePath,
    fileBuffer,
    fileName,
    from,
    to,
    toType,
    engine,
    bilingual,
    bilingualLayout,
    verticalBilingual,
    scanned,
    pageRange,
    namespace,
    metadata,
    pollIntervalMs,
    maxPollAttempts,
    autoDownload,
    confirmed,
    confirmToken,
    outputPath,
    statusEntry = "get_status"
  }) {
    void statusEntry;

    // The deprecated numeric vertical_bilingual (an explicit 0/1 from a stale
    // session) still counts as a chosen layout; bilingual_layout wins when both
    // are given. Undefined stays undefined so the gate and card can tell
    // "nobody chose" from "chose left-right".
    const layout =
      bilingualLayout ??
      (verticalBilingual === undefined || verticalBilingual === null
        ? undefined
        : Number(verticalBilingual) === 1
          ? "top-down"
          : "left-right");

    // Formats are download-time conversions of one finished translation, so
    // to_type may be a single format or an array of them (no extra credits).
    const toTypes = toType === undefined ? [] : [...new Set([].concat(toType))];
    const boundSettings = canonicalSettings({ from, to, toTypes, bilingual, layout, scanned, pageRange });

    // The confirm gate: starting deducts credits, so these must be explicit user
    // choices, never schema or model defaults. Checked before any network call.
    let commitConfirmToken = null;
    if (confirmed) {
      // task_id alone proves nothing (a model can invent one); the confirm_token
      // check below is what ties this call to a card the user was shown.
      if (!taskId) {
        throw new BluenteApiError(
          "confirmed=true requires task_id from a prior unconfirmed call. First call this tool without confirmed to get the page count and settings for the user to review, then call again with the returned task_id and confirmed=true. Nothing was started.",
          { missing_settings: ["task_id"] }
        );
      }

      const missing = [
        ["to", to],
        ["to_type", toType],
        ["bilingual", bilingual],
        // The layout is a Tier-1 choice only when bilingual is on: without it a
        // bilingual user silently got left-right. Off needs no layout at all.
        ...(isBilingualOn(bilingual) ? [["bilingual_layout", layout]] : [])
      ]
        .filter(([, value]) => value === undefined)
        .map(([name]) => name);

      if (missing.length > 0) {
        throw new BluenteApiError(
          `confirmed=true requires explicit values for: ${missing.join(", ")}. Ask the user for these choices, then call again with them set. Nothing was started.`,
          { missing_settings: missing }
        );
      }

      commitConfirmToken = consumeConfirmToken({ token: confirmToken, taskId, settings: boundSettings, now: this.now() });
    }

    // A task_id from the side-channel upload endpoint means the file is already
    // uploaded; the workflow then only polls readiness and starts translation.
    let id = taskId;
    if (!id) {
      const uploadResult = await this.client.uploadFile({
        fileUrl,
        filePath,
        fileBuffer,
        fileName,
        engine,
        glossary: 1
      });
      id = uploadResult?.data?.id;

      if (!id) {
        throw new BluenteApiError("Upload completed but no task id was returned.", {
          backend_payload: clipBackendText(uploadResult)
        });
      }
    }

    const budget = { remaining: maxPollAttempts };

    try {
      const preTranslationStatusPayload = await pollStatusUntilTerminal({
        client: this.client,
        id,
        entry: "get_page_count",
        terminalStatuses: PRE_TRANSLATION_TERMINAL_STATUSES,
        pollIntervalMs,
        budget
      });
      const preTranslationStatus = preTranslationStatusPayload?.data?.status;

      if (preTranslationStatus !== "SERVICE_PROCESSED") {
        throw new BluenteApiError("Uploaded file did not become ready for translation.", {
          id,
          finalStatus: preTranslationStatus,
          backend_message: clipBackendText(preTranslationStatusPayload?.data?.message ?? preTranslationStatusPayload?.message)
        });
      }

      if (!confirmed) {
        const pageCount =
          preTranslationStatusPayload?.data?.pageCount ??
          preTranslationStatusPayload?.data?.page_count ??
          null;
        // Validate the range now, mirroring the backend's ValidatePageRange, so
        // the card never quotes a negative or out-of-bounds cost the confirmed
        // call would only reject. Infinity when the page count is unknown still
        // catches start<1 and descending ranges, which are the ones that misprice.
        if (pageRange) {
          assertValidPageRange(pageRange, typeof pageCount === "number" ? pageCount : Infinity);
        }
        const confirmationSummary = buildConfirmationSummary({
          fileName,
          pageCount,
          from,
          to,
          toTypes,
          bilingual,
          bilingualLayout: layout,
          scanned,
          pageRange
        });

        return {
          task_id: id,
          confirm_token: mintConfirmToken({ taskId: id, settings: boundSettings, now: this.now() }),
          page_count: pageCount,
          started: false,
          confirmation_summary: confirmationSummary,
          // Also emitted as the tool result's leading text content item (see
          // toMcpJson): a fenced block the model pastes whole, so the user sees
          // the exact cost card instead of a paraphrase.
          render_to_user: [
            "Paste the fenced block below into your reply to the user EXACTLY as-is:",
            "",
            "```",
            confirmationSummary,
            "```",
            "",
            "Then ask the user to confirm or adjust (and to answer any (ask the user) and (confirm ...) lines). Stop and wait for the user's reply before calling this tool again."
          ].join("\n"),
          settings: {
            from: from ?? null,
            to: to ?? null,
            to_type: toType ?? null,
            bilingual: bilingual ?? null,
            bilingual_layout: layout ?? null,
            vertical_bilingual: verticalBilingual ?? null,
            mode: scanned ?? null,
            page_range: pageRange ?? null
          },
          next_steps:
            "Nothing has started and no credits were deducted. You MUST render the fenced block in render_to_user to the user exactly as-is — do not paraphrase, shorten, reorder, or omit any line — then end your turn and wait for the user's reply. After they confirm, call this tool again with confirmed=true, this task_id, this confirm_token, and the settings shown on the card, filling in any it asked for (to_type, bilingual, bilingual_layout; mode may only be filled in as 'standard'). If the user changes a setting the card displayed, call again WITHOUT confirmed to get a fresh card and confirm_token. A confirmed call is refused for at least 20 seconds after the card; confirm_token is consumed once the translation starts."
        };
      }

      const translateResult = await this.client.translateFile({
        id,
        action: "start",
        from,
        to,
        engine,
        // Glossary is not a user choice: the product defaults it on, and the LLM
        // pipeline applies it only when BOTH flags are set.
        glossary: 1,
        customGlossary: 1,
        bilingual,
        bilingualLayout: layout,
        verticalBilingual,
        scanned,
        pageRange,
        namespace,
        metadata
      });
      commitConfirmToken?.();
      commitConfirmToken = null;

      const started = {
        id,
        started: true,
        translate_result: translateResult,
      };

      if (!autoDownload) {
        return {
          ...started,
          downloaded: false,
          next_steps:
            "Poll bluente_get_translation_status with this id until data.status is READY, then call bluente_download_file once per requested to_type with this id.",
          message: "Translation task has started."
        };
      }

      // ponytail: blocks the MCP request until translation finishes. Client-side HTTP
      // timeouts are usually tighter than max_poll_attempts, so callers who cannot wait
      // should pass auto_download=false and poll with bluente_get_translation_status.
      const finalStatusPayload = await pollStatusUntilTerminal({
        client: this.client,
        id,
        entry: "get_status",
        terminalStatuses: TERMINAL_TRANSLATION_STATUSES,
        pollIntervalMs,
        budget
      });
      const finalStatus = finalStatusPayload?.data?.status;

      if (finalStatus === "ERROR") {
        throw new BluenteApiError("Translation failed.", {
          id,
          finalStatus,
          backend_message: clipBackendText(finalStatusPayload?.data?.message ?? finalStatusPayload?.message)
        });
      }

      if (finalStatus !== "READY") {
        return {
          ...started,
          downloaded: false,
          final_status: finalStatus ?? null,
          message:
            "Translation is still running after the polling budget was exhausted. Keep polling bluente_get_translation_status with this id, and call bluente_download_file once the status is READY."
        };
      }

      // Every requested format is fetched and saved: they are download-time
      // conversions of one finished translation, so extra formats cost nothing.
      // output_path names the first; the rest keep their own names beside it,
      // rather than scattering into whatever cwd the MCP client launched us in.
      const outputDir = outputPath ? dirname(resolve(expandHome(outputPath))) : undefined;
      const downloads = [];
      for (const [index, requestedType] of toTypes.entries()) {
        downloads.push({
          to_type: requestedType,
          ...(await this.client.downloadFile({
            id,
            toType: requestedType,
            outputPath: index === 0 ? outputPath : undefined,
            outputDir
          }))
        });
      }

      return {
        ...started,
        downloaded: true,
        final_status: "READY",
        download: downloads[0],
        downloads,
        next_steps: "Tell the user where each file was saved (the output_path of every entry in downloads).",
        message: "Translation is complete and the file has been saved to disk."
      };
    } catch (error) {
      if (error instanceof BluenteApiError) {
        error.details = {
          ...(error.details || {}),
          id,
        };
        if (commitConfirmToken) {
          error.message += " The confirm_token was not consumed: retry the same confirmed call with it.";
        }
      }

      throw error;
    }
  }
}
