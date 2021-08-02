const router = require("express").Router();
const userCtrl = require("../controllers/User.ctrl");
const auth = require("../middlewares/auth");
const authAdmin = require("../middlewares/authAdmin");

router.post("/register", userCtrl.register);

router.post("/activation", userCtrl.activateEmail);

module.exports = router;
