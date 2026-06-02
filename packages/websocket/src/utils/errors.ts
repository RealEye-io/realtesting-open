export function createDomError(name: string, message: string): Error {
  try {
    return new DOMException(message, name);
  } catch {
    const error = new Error(message);
    (error as any).name = name;
    return error;
  }
}

