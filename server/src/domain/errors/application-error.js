export class ApplicationError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
  }
}
