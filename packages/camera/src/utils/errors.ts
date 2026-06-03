export function createDOMError(name: string, message: string): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, name);
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = name;
  return error;
}

export function notAllowedError(message: string): Error {
  return createDOMError("NotAllowedError", message);
}

export function notFoundError(message: string): Error {
  return createDOMError("NotFoundError", message);
}

export function overconstrainedError(message: string, constraint: string): Error {
  const error = createDOMError("OverconstrainedError", message) as Error & {
    constraint?: string;
  };
  error.constraint = constraint;
  return error;
}
