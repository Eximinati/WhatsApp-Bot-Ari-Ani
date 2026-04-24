const BufferJSON = {
  replacer: (_, value) => {
    if (Buffer.isBuffer(value)) {
      return { type: "Buffer", data: value.toString("base64") };
    }

    if (value instanceof Uint8Array) {
      return { type: "Buffer", data: Buffer.from(value).toString("base64") };
    }

    if (value && value.type === "Buffer" && Array.isArray(value.data)) {
      return {
        type: "Buffer",
        data: Buffer.from(value.data).toString("base64"),
      };
    }

    return value;
  },
  reviver: (_, value) => {
    if (value && value.type === "Buffer") {
      return Buffer.from(value.data, "base64");
    }

    return value;
  },
};

module.exports = {
  BufferJSON,
};
