const test = require("node:test");
const assert = require("node:assert/strict");

const { createHttpServer } = require("../src/core/http-server");

test("http server protects qr route and serves health", async () => {
  const runtimeState = {
    connectionStatus: "starting",
    qr: "hello-qr",
    startedAt: "now",
  };

  const http = await createHttpServer({
    config: {
      port: 0,
      publicDir: "",
      qrToken: "secret-token",
    },
    logger: { info() {}, error() {} },
    runtimeState,
  });

  const port = http.server.address().port;

  const unauthorized = await fetch(`http://127.0.0.1:${port}/qr`);
  assert.equal(unauthorized.status, 403);

  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true);

  const authorized = await fetch(
    `http://127.0.0.1:${port}/qr?token=secret-token`,
  );
  assert.equal(authorized.status, 200);
  assert.equal(authorized.headers.get("content-type"), "image/png");

  await http.close();
});
