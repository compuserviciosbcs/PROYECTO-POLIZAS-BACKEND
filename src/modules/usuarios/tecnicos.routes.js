const express = require("express");
const db = require("../../database/connection");
const { ok } = require("../../utils/response");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tecnicos WHERE activo = 1 ORDER BY nombre",
    );
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
