const linkLog = require("../modules/linkImport");
const assert = require("assert");
const sinon = require("sinon");
const chai = require("chai");
const db = require("../lib/db");
const expect = chai.expect;

require("./support");

const bot = {
  say: sinon.stub().returns(null)
};

beforeEach(async () => {
  await db.query(`
    DROP TABLE IF EXISTS links;
    DROP TABLE IF EXISTS links_score;
  `);
  await linkLog.migrateSchema();
});

describe("linkLog", () => {
  describe("#parseMessage()", async () => {
    it("should parse and log a URL never seen before ", async () => {
      const row = await linkLog.parseMessage(bot, "User", "#channel", {
        args: [null, "https://mochajs.org/"]
      });
      expect(row.times_seen).to.equal(1);
    });

    it("should parse and log scores for repeated links", async () => {
      await linkLog.parseMessage(bot, "User", "#channel", {
        args: [null, "https://mochajs.org/"]
      });
      await linkLog.parseMessage(bot, "AnotherUser", "#channel", {
        args: [null, "https://mochajs.org/"]
      });

      const originatorScore = await db.query(
        "select * from links_score where channel = $1::text and nick = $2::text",
        ["#channel", "User"]
      );
      expect(originatorScore.rows[0].score).to.equal(1);

      const relinkerScore = await db.query(
        "select * from links_score where channel = $1::text and nick = $2::text",
        ["#channel", "AnotherUser"]
      );
      expect(relinkerScore.rows[0].score).to.equal(-1);
    });
  });
});
