export class BluenteApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BluenteApiError";
    this.details = details;
  }
}

export function normalizeError(error) {
  if (error instanceof BluenteApiError) {
    return {
      name: error.name,
      message: error.message,
      details: error.details
    };
  }

  return {
    name: error?.name || "Error",
    message: error?.message || "Unknown error",
    details: {}
  };
}
