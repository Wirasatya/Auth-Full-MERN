const Users = require("../models/User.model");
const msgRes = require("../msgResponse");

const authAdmin = async (req, res, next) => {
  try {
    const user = await Users.findOne({ _id: req.user.id });

    // user not admin
    if (user.role !== 1)
      return res.status(500).json({ msg: msgRes.adminAccessDenied });

    next();
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

module.exports = authAdmin;
