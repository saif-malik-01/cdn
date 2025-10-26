export type POP_Status = "healthy" | "unhealthy";

export type POP = {
  id: string;
  name: string;
  region: string;
  ip_address: string;
  status: POP_Status;
  latency_ms: number;
  updated_at: Date;
};
