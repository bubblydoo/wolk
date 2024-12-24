import { WolkError } from "../errors/error";

export class InternalWolkError extends WolkError.extend({
  name: "InternalWolkError",
}) {}