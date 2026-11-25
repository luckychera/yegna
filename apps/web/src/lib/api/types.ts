/** Shape of every successful response from the Yegna API. */
export interface Envelope<T> {
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  limit: number;
  offset: number;
  count: number;
  /** Not provided by every endpoint (notifications omit it). */
  total?: number;
}

export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}
