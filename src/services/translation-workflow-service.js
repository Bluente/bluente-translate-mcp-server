import { setTimeout as sleep } from "node:timers/promises";
import { TERMINAL_TRANSLATION_STATUSES } from "../constants/api.js";
import { BluenteApiError } from "../lib/errors.js";

export class TranslationWorkflowService {
  constructor({ client }) {
    this.client = client;
  }

  async runDocumentWorkflow({
    filePath,
    from,
    to,
    toType,
    engine,
    glossary,
    customGlossary,
    bilingual,
    verticalBilingual,
    scanned,
    namespace,
    metadata,
    pollIntervalMs,
    maxPollAttempts,
    autoDownload,
    statusEntry = "pdf",
    outputPath
  }) {
    const uploadResult = await this.client.uploadFile({ filePath, engine, glossary });
    const id = uploadResult?.data?.id;

    if (!id) {
      throw new BluenteApiError("Upload completed but no task id was returned.", {
        uploadResult
      });
    }

    await this.client.translateFile({
      id,
      action: "start",
      from,
      to,
      engine,
      glossary,
      customGlossary,
      bilingual,
      verticalBilingual,
      scanned,
      namespace,
      metadata
    });

    let finalStatusPayload = null;

    for (let i = 0; i < maxPollAttempts; i += 1) {
      const statusPayload = await this.client.getTranslationStatus({ id, entry: statusEntry });
      finalStatusPayload = statusPayload;
      const status = statusPayload?.data?.status;

      if (TERMINAL_TRANSLATION_STATUSES.has(status)) {
        break;
      }

      await sleep(pollIntervalMs);
    }

    const finalStatus = finalStatusPayload?.data?.status;
    if (finalStatus !== "READY") {
      throw new BluenteApiError("Translation job did not reach READY state.", {
        id,
        finalStatus,
        finalStatusPayload
      });
    }

    const download = autoDownload
      ? await this.client.downloadFile({ id, toType, outputPath })
      : null;

    return {
      id,
      finalStatus,
      status: finalStatusPayload,
      download
    };
  }
}
