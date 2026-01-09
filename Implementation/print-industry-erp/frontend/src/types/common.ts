/**
 * Common TypeScript type definitions
 * REQ-LINT-1767982183: Type safety improvements
 */

// GraphQL edge/node pattern types
export interface GraphQLEdge<T> {
  node: T;
  cursor?: string;
}

export interface GraphQLConnection<T> {
  edges: GraphQLEdge<T>[];
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount?: number;
}

// Generic form field handler type
export type FormFieldHandler = (field: string, value: string | number | boolean) => void;

// Event handler types
export type InputChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
export type SelectChangeHandler = (e: React.ChangeEvent<HTMLSelectElement>) => void;
export type FormSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => void;

// API error response type
export interface ApiError {
  message: string;
  code?: string;
  path?: readonly unknown[];
  extensions?: Record<string, unknown>;
}

// Chart data types
export type ChartDataPoint = Record<string, string | number>;
export type ChartSeriesData = {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
};

// Table column accessor types
export type ColumnAccessor<T> = string | ((row: T) => unknown);
export type CellRenderer<T> = (value: unknown, row?: T) => React.ReactNode;
