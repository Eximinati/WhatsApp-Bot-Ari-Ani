const test = require("node:test");
const assert = require("node:assert/strict");

const { IslamicService } = require("../src/services/islamic-service");

test("IslamicService returns curated Khalifa profile", () => {
  const service = new IslamicService();
  const result = service.getKhalifa("umar");
  assert.equal(result.mode, "profile");
  assert.match(result.profile.name, /Umar/i);
});

test("IslamicService returns arbain lesson by number", () => {
  const service = new IslamicService();
  const result = service.getArbain("1");
  assert.equal(result.number, 1);
  assert.match(result.reference, /Nawawi/i);
});

test("IslamicService answers supported FAQ with citations", async () => {
  const service = new IslamicService();
  const result = await service.answerIslamicQuestion("why is charity important in islam?");
  assert.equal(result.ok, true);
  assert.ok(result.citations.length > 0);
  assert.equal(result.questionType, "ethics");
});

test("IslamicService routes rafadain to fiqh-dispute mode", async () => {
  const service = new IslamicService();
  const result = await service.answerIslamicQuestion("if we pray with rafadain then our namaz is invalid?");
  assert.equal(result.ok, true);
  assert.equal(result.questionType, "fiqh-dispute");
  assert.match(result.issueTitle, /Raf'? al-Yadayn/i);
  assert.ok(result.quranEvidence.length > 0);
  assert.ok(result.hadithEvidence.length > 0);
  assert.equal(result.madhhabViews.length, 4);
  assert.ok(result.sourceLinks.length > 0);
  assert.match(result.madhhabViews.map((view) => view.school).join(" | "), /Hanafi/);
  assert.doesNotMatch(result.answerEn, /\binvalid\b/i);
  assert.match(result.safetyNote, /not a fatwa|recognized scholarly difference/i);
});

test("IslamicService routes behind-imam recitation to fiqh-dispute mode", async () => {
  const service = new IslamicService();
  const result = await service.answerIslamicQuestion("should i recite surah fatiha behind imam?");
  assert.equal(result.ok, true);
  assert.equal(result.questionType, "fiqh-dispute");
  assert.match(result.issueTitle, /Recitation Behind the Imam/i);
  assert.equal(result.madhhabViews.length, 4);
  assert.ok(result.hadithEvidence.some((item) => /Bukhari 756|Muslim 394/i.test(item.ref)));
});

test("IslamicService refuses unsupported questions", async () => {
  const service = new IslamicService();
  const result = await service.answerIslamicQuestion("what is the best football team?");
  assert.equal(result.ok, false);
  assert.match(result.message, /could not verify/i);
});
