const allowedMethods = ["GET", "HEAD"];

export function validateMethod(method) {
  return !allowedMethods.includes(method);
}
