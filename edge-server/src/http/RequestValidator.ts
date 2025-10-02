const ALLOWED_METHODS = ["GET", "HEAD"];

export class RequestValidator {
  static validateMethod(method: string): boolean {
    return !!method && !ALLOWED_METHODS.includes(method);
  }
}
