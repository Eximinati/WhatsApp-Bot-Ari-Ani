const FILTER_STATE = Symbol.for("ari_ani_terminal_filter_state");

function createTerminalNoiseFilter(originalWrite) {
  const state = {
    buffer: "",
    suppressBadMacStack: false,
    suppressSessionDump: false,
    sessionDumpDepth: 0,
  };

  function writeChunk(chunk, encoding, callback) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString(encoding || "utf8") : String(chunk);
    state.buffer += text;

    let newlineIndex = state.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = state.buffer.slice(0, newlineIndex + 1);
      state.buffer = state.buffer.slice(newlineIndex + 1);
      emitLine(line);
      newlineIndex = state.buffer.indexOf("\n");
    }

    if (typeof callback === "function") {
      callback();
    }

    return true;
  }

  function flush() {
    if (state.buffer) {
      emitLine(state.buffer);
      state.buffer = "";
    }
  }

  function emitLine(line) {
    const normalized = line.replace(/\r?\n$/, "");
    if (shouldSuppressLine(state, normalized)) {
      return;
    }

    originalWrite(line);
  }

  return {
    flush,
    writeChunk,
  };
}

function shouldSuppressLine(state, line) {
  if (state.suppressBadMacStack) {
    if (/^\s+at\s/.test(line) || /^\s*$/.test(line)) {
      return true;
    }

    state.suppressBadMacStack = false;
  }

  if (state.suppressSessionDump) {
    state.sessionDumpDepth += countOccurrences(line, "{");
    state.sessionDumpDepth -= countOccurrences(line, "}");
    if (state.sessionDumpDepth <= 0) {
      state.suppressSessionDump = false;
      state.sessionDumpDepth = 0;
    }
    return true;
  }

  if (/^Failed to decrypt message with any known session\.\.\./.test(line)) {
    return true;
  }

  if (/^Session error:Error: Bad MAC Error: Bad MAC/.test(line)) {
    state.suppressBadMacStack = true;
    return true;
  }

  if (/^Session error:SessionError: Over 2000 messages into the future!/.test(line)) {
    state.suppressBadMacStack = true;
    return true;
  }

  if (/^Closing open session in favor of incoming prekey bundle$/.test(line)) {
    return true;
  }

  if (/^Closing session: SessionEntry \{/.test(line)) {
    state.suppressSessionDump = true;
    state.sessionDumpDepth = countOccurrences(line, "{") - countOccurrences(line, "}");
    return true;
  }

  return false;
}

function countOccurrences(text, token) {
  return String(text).split(token).length - 1;
}

function installTerminalOutputFilter() {
  if (globalThis[FILTER_STATE]) {
    return globalThis[FILTER_STATE];
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const stdoutFilter = createTerminalNoiseFilter(originalStdoutWrite);
  const stderrFilter = createTerminalNoiseFilter(originalStderrWrite);

  process.stdout.write = function patchedStdoutWrite(chunk, encoding, callback) {
    return stdoutFilter.writeChunk(chunk, encoding, callback);
  };

  process.stderr.write = function patchedStderrWrite(chunk, encoding, callback) {
    return stderrFilter.writeChunk(chunk, encoding, callback);
  };

  const handleExit = () => {
    stdoutFilter.flush();
    stderrFilter.flush();
  };

  process.once("beforeExit", handleExit);
  process.once("exit", handleExit);

  globalThis[FILTER_STATE] = {
    installed: true,
  };

  return globalThis[FILTER_STATE];
}

module.exports = {
  createTerminalNoiseFilter,
  installTerminalOutputFilter,
};
