const allowedMethods = ["GET", "HEAD"];

export function validateMethod(method?:string) {
  return method && !allowedMethods.includes(method);
}
