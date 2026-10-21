import { describe, expect, it } from "vitest";

import { execFileBoundedOutput } from "./ExecFileBoundedOutput.js";

describe("execFileBoundedOutput", () => {
  it("lets a command finish after its output exceeds the capture limit", async () => {
    const result = await execFileBoundedOutput(
      process.execPath,
      [
        "-e",
        "process.stdout.write('x'.repeat(70000)); process.stderr.write('failure detail');",
      ],
      { env: process.env, limit: 64 * 1024 },
    );
    expect(result.exitCode).toBe(0);
    expect(Buffer.byteLength(result.stdout)).toBeLessThan(64 * 1024 + 50);
    expect(result.stdout).toContain("[output omitted]");
    expect(result.stderr).toBe("failure detail");
    expect(result.outputTruncated).toBe(true);
  });

  it("retains a failing command's status and stderr after verbose stdout", async () => {
    const result = await execFileBoundedOutput(
      process.execPath,
      [
        "-e",
        "process.stdout.write('x'.repeat(70000)); process.stderr.write('package conflict'); process.exitCode = 1;",
      ],
      { env: process.env, limit: 64 * 1024 },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("package conflict");
    expect(result.outputTruncated).toBe(true);
  });

  it("retains a final error after a long prefix in the same stream", async () => {
    const result = await execFileBoundedOutput(
      process.execPath,
      [
        "-e",
        "process.stderr.write('warning '.repeat(10000)); process.stderr.write('error: final conflict'); process.exitCode = 1;",
      ],
      { env: process.env, limit: 64 * 1024 },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[output omitted]");
    expect(result.stderr).toContain("error: final conflict");
    expect(result.outputTruncated).toBe(true);
  });

  it("does not split multi-byte characters at the omitted-output boundaries", async () => {
    // 3-byte characters with an odd limit force both cut points mid-character.
    const result = await execFileBoundedOutput(
      process.execPath,
      ["-e", "process.stdout.write('가'.repeat(100));"],
      { env: process.env, limit: 31 },
    );
    expect(result.outputTruncated).toBe(true);
    expect(result.stdout).toContain("[output omitted]");
    expect(result.stdout).not.toContain("\uFFFD");
    expect(result.stdout).toMatch(/^가+ … \[output omitted\] … 가+$/u);
  });
});
