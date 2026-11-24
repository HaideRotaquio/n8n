import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clampExpiry,
  contentDisposition,
  createFsDriver,
  createS3Driver,
  createStorageFromEnv,
  validateKey,
  verifyFsDownload,
  type StorageDriver,
} from "./index";

const SECRET = "storage-signing-secret-for-tests-0123456789";

describe("keys", () => {
  it("accepts normal keys", () => {
    expect(validateKey("brands/brd_1/assets/ast_2/v1/package.zip")).toBeTruthy();
  });
  it.each(["", "/abs", "a/../b", "a//b", "..", "a/.hidden", "a b", "a/b?x", "a\\b", "x".repeat(600)])(
    "rejects %j",
    (k) => {
      expect(() => validateKey(k)).toThrow();
    },
  );
  it("clamps expiry", () => {
    expect(clampExpiry(1)).toBe(60);
    expect(clampExpiry(99999)).toBe(3600);
    expect(clampExpiry(undefined)).toBe(300);
  });
  it("builds safe content-disposition", () => {
    expect(contentDisposition('evil"name.zip')).toContain('filename="evil_name.zip"');
    expect(contentDisposition("café.zip")).toContain("filename*=UTF-8''caf%C3%A9.zip");
  });
  it("requires S3 credentials when STORAGE_DRIVER=s3", () => {
    expect(() => createStorageFromEnv({ STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET/);
    expect(() => createStorageFromEnv({ STORAGE_DRIVER: "ftp" })).toThrow(/Unknown/);
  });
});

async function contract(getDriver: () => StorageDriver) {
  it("puts, reads, checks and deletes objects", async () => {
    const d = getDriver();
    const res = await d.put("brands/brd_t/test/hello.txt", "hello", { contentType: "text/plain" });
    expect(res.bytes).toBe(5);
    expect(res.sha256).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(await d.exists("brands/brd_t/test/hello.txt")).toBe(true);
    expect(Buffer.from((await d.get("brands/brd_t/test/hello.txt"))!).toString()).toBe("hello");
    await d.delete("brands/brd_t/test/hello.txt");
    expect(await d.exists("brands/brd_t/test/hello.txt")).toBe(false);
    expect(await d.get("brands/brd_t/test/hello.txt")).toBeNull();
  });
  it("refuses traversal keys", async () => {
    await expect(getDriver().put("../escape.txt", "x")).rejects.toThrow();
  });
}

describe("fs driver", () => {
  let dir: string;
  let driver: StorageDriver;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "sb-storage-"));
    driver = createFsDriver({ root: dir, downloadBaseUrl: "http://localhost:3100/api/storage/download", signingSecret: SECRET });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  contract(() => driver);

  it("requires a long signing secret", () => {
    expect(() => createFsDriver({ root: dir, downloadBaseUrl: "http://x/", signingSecret: "short" })).toThrow();
  });

  it("creates signed URLs that verify, and rejects tampering and expiry", async () => {
    let t = 1_700_000_000_000;
    const d = createFsDriver({ root: dir, downloadBaseUrl: "http://localhost/dl", signingSecret: SECRET, now: () => t });
    const url = new URL(await d.createDownloadUrl("a/b.zip", { expiresInSeconds: 120, filename: "pack.zip" }));
    expect(verifyFsDownload(url.searchParams, SECRET, () => t)).toEqual({ key: "a/b.zip", filename: "pack.zip" });

    const tamperedKey = new URLSearchParams(url.searchParams);
    tamperedKey.set("key", "a/other.zip");
    expect(verifyFsDownload(tamperedKey, SECRET, () => t)).toBeNull();

    const tamperedExp = new URLSearchParams(url.searchParams);
    tamperedExp.set("exp", String(Number(url.searchParams.get("exp")) + 9999));
    expect(verifyFsDownload(tamperedExp, SECRET, () => t)).toBeNull();

    expect(verifyFsDownload(url.searchParams, "another-secret-another-secret-0000000", () => t)).toBeNull();
    t += 121_000;
    expect(verifyFsDownload(url.searchParams, SECRET, () => t)).toBeNull();
  });
});

/**
 * S3 contract tests run against a local S3 emulator (moto) when MOTO_SERVER_BIN points to `moto_server`.
 * They are skipped otherwise; CI installs moto so they always run there.
 */
const motoBin = process.env.MOTO_SERVER_BIN;
describe.skipIf(!motoBin)("s3 driver (against moto S3 emulator)", () => {
  let proc: ChildProcess;
  let driver: StorageDriver;
  let endpoint: string;

  beforeAll(async () => {
    const port = await new Promise<number>((resolve) => {
      const srv = createServer().listen(0, () => {
        const p = (srv.address() as { port: number }).port;
        srv.close(() => resolve(p));
      });
    });
    endpoint = `http://127.0.0.1:${port}`;
    proc = spawn(motoBin!, ["-p", String(port)], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(endpoint);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const creds = { accessKeyId: "test", secretAccessKey: "test" };
    await new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true, credentials: creds }).send(
      new CreateBucketCommand({ Bucket: "daos-test" }),
    );
    driver = createS3Driver({ endpoint, region: "us-east-1", bucket: "daos-test", ...creds });
  });
  afterAll(() => {
    proc?.kill();
  });

  contract(() => driver);

  it("creates presigned download URLs that work and carry the filename", async () => {
    await driver.put("pkg/demo.zip", "zipdata");
    const url = await driver.createDownloadUrl("pkg/demo.zip", { filename: "Demo Pack.zip", expiresInSeconds: 60 });
    expect(url).toContain("X-Amz-Expires=60");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("zipdata");
    expect(res.headers.get("content-disposition")).toContain("Demo Pack.zip");
    const tampered = url.replace("pkg%2Fdemo.zip", "pkg%2Fother.zip").replace("pkg/demo.zip", "pkg/other.zip");
    expect((await fetch(tampered)).status).toBeGreaterThanOrEqual(400);
  });
});
