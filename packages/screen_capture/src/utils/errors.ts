export function createDomError(name: string, message: string): Error {
  try {
    // DOMException is preferred to match browser behavior.
    return new DOMException(message, name);
  } catch {
    const error = new Error(message);
    (error as any).name = name;
    return error;
  }
}

export function notAllowedError(message: string): Error {
  return createDomError("NotAllowedError", message);
}

export function notFoundError(message: string): Error {
  return createDomError("NotFoundError", message);
}

export function notSupportedError(message: string): Error {
  return createDomError("NotSupportedError", message);
}

