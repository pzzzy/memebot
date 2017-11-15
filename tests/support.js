const db = require("../lib/db");

if (process.env.NODE_ENV != "test") {
  console.log("Run with NODE_ENV=test");
  process.exit();
}

after(async () => {
  await db.pool.end();
});
