const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTerminalNoiseFilter,
} = require("../src/config/terminal-output");

test("terminal output filter suppresses libsignal decrypt spam and session dumps", () => {
  const writes = [];
  const filter = createTerminalNoiseFilter((chunk) => {
    writes.push(String(chunk));
    return true;
  });

  filter.writeChunk("Failed to decrypt message with any known session...\n");
  filter.writeChunk("Session error:Error: Bad MAC Error: Bad MAC\n");
  filter.writeChunk("    at verifyMAC (...)\n");
  filter.writeChunk("Closing open session in favor of incoming prekey bundle\n");
  filter.writeChunk("Closing session: SessionEntry {\n");
  filter.writeChunk("  indexInfo: {\n");
  filter.writeChunk("  }\n");
  filter.writeChunk("}\n");
  filter.writeChunk("[2026-04-27 00:07:10] INFO Command handled\n");
  filter.flush();

  const output = writes.join("");
  assert.doesNotMatch(output, /Failed to decrypt message with any known session/);
  assert.doesNotMatch(output, /Bad MAC/);
  assert.doesNotMatch(output, /Closing session: SessionEntry/);
  assert.match(output, /Command handled/);
});
