const test = require("node:test");
const assert = require("node:assert/strict");

const { VuService } = require("../src/services/vu-service");

function createService() {
  return new VuService({
    config: {
      security: { appEncryptionKey: "" },
      vu: {
        baseUrl: "https://vulms.vu.edu.pk",
        loginPath: "/",
        homePath: "/Home.aspx",
        calendarPath: "/ActivityCalendar/ActivityCalendar.aspx",
      },
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });
}

const LOGIN_HTML = `
<form method="post" action="./" id="ctl00">
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="view-state-value">
  <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="generator-value">
  <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="event-validation-value">
  <input name="txtStudentID" maxlength="12" id="txtStudentID" type="text">
  <input name="txtPassword" type="password" id="txtPassword">
  <input type="submit" name="ibtnLogin" value="Sign In" id="ibtnLogin">
  <input type="hidden" id="g-recaptcha-response" name="g-recaptcha-response" value="captcha-token">
  <input type="hidden" name="action" value="beta_LMS">
</form>
`;

const CALENDAR_HTML = `
<script>
  var JsonData = [
    {
      "Semester":"Spring 2026",
      "title":"CS301: Assignment# 1",
      "start":"2026,04,23",
      "end":"2026,05,01",
      "coursecode":"CS301",
      "url":"/ActivityCalendar/OpenActivitySection.aspx?coursecode=CS301\\u0026ActivityType=Assignment",
      "IsExpired":"0",
      "allDay":"true"
    },
    {
      "Semester":"Spring 2026",
      "title":"CS301P: Lab 1 Quiz",
      "start":"2026,04,24",
      "end":"2026,04,27",
      "coursecode":"CS301P",
      "url":"/ActivityCalendar/OpenActivitySection.aspx?coursecode=CS301P\\u0026ActivityType=QuizList",
      "IsExpired":"0",
      "allDay":"true"
    }
  ];
</script>
`;

const LOGIN_ERROR_HTML = `
<div id="divError" class="m-alert m-alert--outline alert alert-danger alert-dismissible" role="alert" style="display:block;">
  <div class="row">
    <div class="m--padding-right-30">
      <span id="lblError" style="color:Red;">Incorrect user name or password. The account will be locked after 5 failed login attempts.</span>
    </div>
  </div>
</div>
`;

const HIDDEN_DEMO_WARNING_HTML = `
<div id="divError" class="m-alert m-alert--outline alert alert-danger alert-dismissible" role="alert" style="display: none">
  <div class="row">
    <div class="m--padding-right-30">
      <span id="lblError">Incorrect username or password. Please try again.</span>
    </div>
  </div>
</div>
<div id="lblInvalidIp" class="form-control-feedback" style="display: none">
  Demo account can only be used from university premises and authorized locations.
</div>
`;

test("extractLoginError reads the visible LMS login error text", () => {
  const service = createService();

  assert.match(service.extractLoginError(LOGIN_ERROR_HTML), /Incorrect user name or password/i);
});

test("extractLoginError ignores hidden demo/ip warnings", () => {
  const service = createService();

  assert.equal(service.extractLoginError(HIDDEN_DEMO_WARNING_HTML), "");
});

test("extractLoginFormState reads the newer LMS root form fields", () => {
  const service = createService();
  const state = service.extractLoginFormState(LOGIN_HTML);

  assert.deepEqual(state, {
    __VIEWSTATE: "view-state-value",
    __VIEWSTATEGENERATOR: "generator-value",
    __EVENTVALIDATION: "event-validation-value",
    recaptchaResponse: "captcha-token",
    action: "beta_LMS",
  });
});

test("buildLoginBody posts the exact newer LMS field names", () => {
  const service = createService();
  const body = service.buildLoginBody({
    username: "BC260230194",
    password: "secret",
    formState: service.extractLoginFormState(LOGIN_HTML),
  });

  assert.equal(body.get("txtStudentID"), "BC260230194");
  assert.equal(body.get("txtPassword"), "secret");
  assert.equal(body.get("ibtnLogin"), "Sign In");
  assert.equal(body.get("action"), "beta_LMS");
  assert.equal(body.get("g-recaptcha-response"), "captcha-token");
});

test("parseReminderOffsets supports days hours and minutes", () => {
  const service = createService();

  assert.deepEqual(service.parseReminderOffsets("1d, 6h, 30m"), [30, 360, 1440]);
  assert.deepEqual(service.parseReminderOffsets("24 3"), [180, 1440]);
});

test("extractCalendarJson parses JsonData from the To Do Calendar page", () => {
  const service = createService();
  const items = service.extractCalendarJson(CALENDAR_HTML);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, "CS301: Assignment# 1");
  assert.equal(items[1].coursecode, "CS301P");
});

test("normalizeCalendarItems converts LMS calendar entries into bot-friendly records", () => {
  const service = createService();
  const items = service.normalizeCalendarItems(
    service.extractCalendarJson(CALENDAR_HTML),
    "https://vulms.vu.edu.pk",
  );

  assert.equal(items.length, 2);
  const assignment = items.find((item) => item.type === "assignment");
  const quiz = items.find((item) => item.type === "quiz");

  assert.ok(assignment);
  assert.ok(quiz);
  assert.equal(assignment.course, "CS301");
  assert.equal(assignment.url.includes("ActivityType=Assignment"), true);
  assert.equal(assignment.dueAt, "2026-05-01T00:00:00.000Z");
  assert.equal(assignment.dueText, "23 Apr 2026 to 01 May 2026");

  assert.equal(quiz.courseCode, "CS301P");
  assert.equal(quiz.startAt, "2026-04-24T00:00:00.000Z");
});

test("isLoginFailureHtml recognizes the root LMS login page", () => {
  const service = createService();

  assert.equal(service.isLoginFailureHtml(LOGIN_HTML), true);
  assert.equal(service.isLoginFailureHtml(LOGIN_ERROR_HTML), true);
  assert.equal(service.isLoginFailureHtml("<html><body><h1>Home</h1></body></html>"), false);
});

test("login verifies credentials before storing them", async () => {
  const service = createService();
  service.config.security.appEncryptionKey = "top-secret";

  let saveCalled = false;
  const account = {
    username: "",
    encryptedPassword: "",
    assignmentsJson: "",
    calendarJson: "",
    lastError: "",
    lastSyncAt: null,
    async save() {
      saveCalled = true;
    },
  };

  service.getAccount = async () => account;
  service.fetchCalendarItems = async () => [
    {
      title: "CS301: Assignment# 1",
      course: "CS301",
      courseCode: "CS301",
      type: "assignment",
      dueText: "23 Apr 2026 to 01 May 2026",
      dueAt: "2026-05-01T00:00:00.000Z",
      startAt: "2026-04-23T00:00:00.000Z",
      endAt: "2026-05-01T00:00:00.000Z",
      url: "https://vulms.vu.edu.pk/ActivityCalendar/OpenActivitySection.aspx",
    },
  ];

  const result = await service.login("user@s.whatsapp.net", "BC260230194", "secret-password");

  assert.equal(saveCalled, true);
  assert.equal(result.assignments.length, 1);
  assert.equal(account.username, "BC260230194");
  assert.match(account.encryptedPassword, /^enc:v1:/);
  assert.equal(JSON.parse(account.assignmentsJson).length, 1);
  assert.equal(JSON.parse(account.calendarJson).length, 1);
});

test("getAssignments uses cached snapshot after a successful login sync", async () => {
  const service = createService();
  let syncCalls = 0;

  service.getAccount = async () => ({
    username: "BC260230194",
    encryptedPassword: "enc:v1:cached",
    assignmentsJson: JSON.stringify([
      {
        title: "CS301: Assignment# 1",
        dueAt: "2026-05-01T00:00:00.000Z",
        startAt: "2026-04-23T00:00:00.000Z",
      },
    ]),
    calendarJson: JSON.stringify([{ title: "CS301: Assignment# 1" }]),
    lastSyncAt: new Date(),
  });

  service.sync = async () => {
    syncCalls += 1;
    throw new Error("sync should not be called when cache is fresh");
  };

  const assignments = await service.getAssignments("user@s.whatsapp.net");

  assert.equal(assignments.length, 1);
  assert.equal(syncCalls, 0);
});

test("getAssignments falls back to cached snapshot when refresh fails", async () => {
  const service = createService();
  service.cacheMaxAgeMs = 1;

  service.getAccount = async () => ({
    username: "BC260230194",
    encryptedPassword: "enc:v1:cached",
    assignmentsJson: JSON.stringify([
      {
        title: "CS301: Assignment# 1",
        dueAt: "2026-05-01T00:00:00.000Z",
        startAt: "2026-04-23T00:00:00.000Z",
      },
    ]),
    calendarJson: JSON.stringify([{ title: "CS301: Assignment# 1" }]),
    lastSyncAt: new Date(Date.now() - 10_000),
  });

  service.sync = async () => {
    throw new Error("VU login failed during refresh");
  };

  const assignments = await service.getAssignments("user@s.whatsapp.net");

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].title, "CS301: Assignment# 1");
});

test("getPendingDeadlineReminders chooses the nearest matching threshold and dedupes by key", () => {
  const service = createService();
  const reminders = service.getPendingDeadlineReminders(
    [
      {
        title: "CS301: Assignment# 1",
        dueAt: "2026-05-01T12:00:00.000Z",
        dueText: "01 May 2026",
      },
    ],
    [30, 180, 1440],
    new Set(),
    new Date("2026-05-01T10:20:00.000Z"),
  );

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].reminderMinutes, 180);
  assert.equal(reminders[0].reminderLabel, "3h");

  const deduped = service.getPendingDeadlineReminders(
    [
      {
        title: "CS301: Assignment# 1",
        dueAt: "2026-05-01T12:00:00.000Z",
        dueText: "01 May 2026",
      },
    ],
    [30, 180, 1440],
    new Set([reminders[0].notificationKey]),
    new Date("2026-05-01T10:20:00.000Z"),
  );
  assert.equal(deduped.length, 0);
});
