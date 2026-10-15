import "server-only";
import { env } from "@/lib/env";
import { LocalStorageDriver } from "./local";
import { SupabaseStorageDriver } from "./supabase";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

/** Private object storage. All objects are private; access via short-lived signed URLs. */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver = e.STORAGE_DRIVER === "supabase"
    ? new SupabaseStorageDriver(e.NEXT_PUBLIC_SUPABASE_URL ?? "", e.SUPABASE_SERVICE_ROLE_KEY ?? "", e.SUPABASE_STORAGE_BUCKET)
    : new LocalStorageDriver(e.LOCAL_STORAGE_DIR, e.APP_SECRET);
  return driver;
}

export const paths = {
  resume: (orgId: string, candidateId: string, docId: string, ext: string) => `${orgId}/candidates/${candidateId}/resume-${docId}.${ext}`,
  candidatePrefix: (orgId: string, candidateId: string) => `${orgId}/candidates/${candidateId}/`,
  recordingChunk: (orgId: string, interviewId: string, part: number, index: number) =>
    `${orgId}/interviews/${interviewId}/recording/part-${part}/chunk-${String(index).padStart(6, "0")}.bin`,
  recordingChunkPrefix: (orgId: string, interviewId: string, part: number) => `${orgId}/interviews/${interviewId}/recording/part-${part}/`,
  recordingFile: (orgId: string, interviewId: string, part: number) => `${orgId}/interviews/${interviewId}/recording/part-${part}.webm`,
  interviewPrefix: (orgId: string, interviewId: string) => `${orgId}/interviews/${interviewId}/`,
  logo: (orgId: string, version: number, ext: string) => `${orgId}/branding/logo-${version}.${ext}`,
};
