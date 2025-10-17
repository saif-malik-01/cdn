const ALLOWED_METHODS = ["GET", "HEAD"];
const MAX_CONTENT_LENGTH = 524288000; // 500MB

export class RequestValidator {
  static validateMethod(method: string): boolean {
    return !!method && !ALLOWED_METHODS.includes(method);
  }

  static validateContentLength(contentLength?: number): boolean {
    return !!contentLength && contentLength <= MAX_CONTENT_LENGTH;
  }
}
