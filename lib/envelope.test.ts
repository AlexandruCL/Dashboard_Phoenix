// Run: pnpm test. Same vector as the bot's pytest, so both sides agree on the wire format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, seal } from "./envelope.ts";

const key = Buffer.from("ERERERERERERERERERERERERERERERERERERERERERE=", "base64");
const nonce = Buffer.from("222222222222222222222222", "hex");
const plaintext =
  '{"v":1,"ts":1700000000,"req_id":"00000000-0000-4000-8000-000000000001","actor_id":"123456789012345678","method":"GET","path":"/ping","body":null}';
const envelope =
  "IiIiIiIiIiIiIiIibNVxa/r+s32RTPwGeZHZ5S+j/dJasYBpICp7t2CFRzlnT5syY5jJ7n513R3WaGQBg+KuT61CSs6ZRNrJ0lvfgki8LAhgp30wigJC/mW2l2jHh4EPMd3vZm826ZMOkzPnvHRlKUF1p2wx+Zl/Gz+9H0Fer/NyA+VN4k8PDCvNO6gt9ofdtSNKHHg5IO+XOgJwdXB37d4fUfO+cMeYY7t2PkA=";

test("seal matches the shared vector", () => {
  assert.equal(seal(key, JSON.parse(plaintext), nonce), envelope);
});

test("open reads the shared vector", () => {
  assert.deepEqual(open(key, envelope), JSON.parse(plaintext));
});

test("open rejects tampered data and a wrong key", () => {
  const buf = Buffer.from(envelope, "base64");
  buf[20] ^= 1;
  assert.throws(() => open(key, buf.toString("base64")));
  assert.throws(() => open(Buffer.alloc(32, 0x33), envelope));
  assert.throws(() => open(key, "AAAA"));
});

test("round trip with a random nonce", () => {
  const msg = { req_id: "x", status: 200, body: { ok: true } };
  assert.deepEqual(open(key, seal(key, msg)), msg);
});
