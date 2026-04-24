const test = require("node:test");
const assert = require("node:assert/strict");

const { createLogger } = require("../src/config/logger");

test("logger collapses repeated baileys decrypt errors into readable warnings", () => {
  const logger = createLogger({ logLevel: "info" }).child({ module: "baileys" });
  const writes = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    logger.error(
      {
        key: {
          remoteJid: "120363423344942048@g.us",
          participant: "175754474201090@lid",
          id: "MSG1",
        },
      },
      "failed to decrypt message",
    );

    logger.error(
      {
        key: {
          remoteJid: "120363423344942048@g.us",
          participant: "175754474201090@lid",
          id: "MSG2",
        },
      },
      "failed to decrypt message",
    );
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  const output = writes.join("");
  assert.match(output, /Skipped undecryptable WhatsApp message/);
  assert.doesNotMatch(output, /MSG2/);
});

test("logger rewrites baileys init timeout to a clearer warning", () => {
  const logger = createLogger({ logLevel: "info" }).child({ module: "baileys" });
  const writes = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  try {
    logger.error(
      {
        err: {
          output: {
            statusCode: 408,
          },
        },
      },
      "unexpected error in 'init queries'",
    );
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  const output = writes.join("");
  assert.match(output, /WhatsApp startup sync timed out; continuing with live events/);
  assert.match(output, /statusCode=408/);
});
