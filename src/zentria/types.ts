export type ZentriaRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown> | unknown;
  accept?: string;
  /** Extra request headers, for example Idempotency-Key. They cannot replace Authorization, Accept, User-Agent or Content-Type. */
  headers?: Record<string, string>;
};

export type ZentriaMeResponse = {
  id?: number;
  name?: string;
  email?: string;
  currentTeam?: {
    id?: number;
    name?: string;
  };
  modules?: Record<string, boolean>;
  scopes?: string[];
};
