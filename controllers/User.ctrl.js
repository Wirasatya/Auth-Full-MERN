const Users = require("../models/User.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("./sendEmail");
const resMsg = require("../msgResponse");

const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const fetch = require("node-fetch");
const { findOne } = require("../models/User.model");

const { CLIENT_URL } = process.env;

const userCtrl = {
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body; //const name = req.body.name;

      if (!email || !name || !password)
        return res.status(400).json({ msg: resMsg.fillAllField }); //email, name, password required

      if (!validateEmail(email))
        return res.status(400).json({ msg: resMsg.invalidEmail }); // incorrect format email

      const user = await Users.findOne({ email });
      if (user) return res.status(400).json({ msg: resMsg.emailAlreadyExist }); // email already exist

      if (password.length < 6)
        return res.status(400).json({ msg: resMsg.passwordMust6Length }); // password length must 6

      const passwordHash = await bcrypt.hash(password, 12);
      const newUser = {
        name,
        email,
        password: passwordHash,
      }; // data new user

      const activation_token = createActivationToken(newUser);
      const url = `${CLIENT_URL}/user/activate/${activation_token}`;

      // console.log(activation_token); //for check activation_token value

      sendEmail(email, url, "Verify your email address"); //send verification email to register account

      res.json({
        msg: resMsg.successRegisterPleaseActivated,
      }); //register success, next step open your email and activation a account
    } catch (err) {
      res.status(500).json({ msg: err.message }); //something wrong on route user/register
    }
  },
  activateEmail: async (req, res) => {
    try {
      const { activation_token } = req.body;
      const user = jwt.verify(
        activation_token,
        process.env.ACTIVATION_TOKEN_SECRET
      ); // decode from activation_token to data register (name, email, password, timestamp)

      // console.log(user); //for check user value

      const { name, email, password } = user; // const user = user.name

      const check = await Users.findOne({ email });
      if (check) return res.status(400).json({ msg: resMsg.emailAlreadyExist }); //check email already exist or not

      const newUser = new Users({
        name,
        email,
        password,
      });

      await newUser.save(); //create new user to Monggo DB

      res.json({ msg: resMsg.accountActivated }); // response success activation email
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/activation
    }
  },
};

function validateEmail(email) {
  const re =
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
} // validate email regex

const createActivationToken = (payload) => {
  return jwt.sign(payload, process.env.ACTIVATION_TOKEN_SECRET, {
    expiresIn: "5m",
  });
}; // create activation token

const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "1d",
  });
}; // create refresh token

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
}; // create access token

module.exports = userCtrl;
