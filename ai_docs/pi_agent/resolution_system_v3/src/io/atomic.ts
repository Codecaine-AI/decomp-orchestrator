import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";

function tempPath(path: string): string {
  return resolve(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
}

export async function atomicWriteFile(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = tempPath(path);
  try {
    await writeFile(tmp, data);
    await rename(tmp, path);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function atomicCopyFile(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const tmp = tempPath(destination);
  try {
    await copyFile(source, tmp);
    await rename(tmp, destination);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}
