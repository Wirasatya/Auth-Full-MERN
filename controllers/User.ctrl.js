const Users = require("../models/User.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("./sendEmail");
const resMsg = require("../msgResponse");

const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const fetch = require("node-fetch");

const client = new OAuth2(process.env.MAILING_SERVICE_CLIENT_ID);

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
  login: async (req, res) => {
    try {
      const { email, password } = req.body; // const email = req.body.email
      const user = await Users.findOne({ email }); //findOne match email from mongoDB
      if (!user) return res.status(400).json({ msg: resMsg.emailNotExist }); //email not exist on mongoDB

      const isMatch = await bcrypt.compare(password, user.password); //compare password from client and mongoDB
      if (!isMatch) return res.status(400).json({ msg: resMsg.incorrectPass }); //password not match

      const refresh_token = createRefreshToken({ id: user._id }); // create refresh token
      res.cookie("refreshtoken", refresh_token, {
        httpOnly: true,
        path: "/user/refresh_token",
        maxAge: 24 * 60 * 60 * 1000, // 1 days expired
      }); // send refresh token to cookies

      res.status(200).json({ msg: resMsg.loginSuccess }); //login success
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/login
    }
  },
  getAccessToken: (req, res) => {
    try {
      const rf_token = req.cookies.refreshtoken; // get refresh token from cookies
      if (!rf_token) return res.status(400).json({ msg: resMsg.pleaseLogin }); // not refresh token on cookies

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(400).json({ msg: resMsg.pleaseLogin }); // something wrong on refresh token

        // console.log(user) //check value of decode refresh token
        const access_token = createAccessToken({ id: user.id }); // encode user value to make access_token
        res.json({ access_token }); // res value of access_token
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/refresh_token
    }
  },
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body; // set email value from req.body.email
      const user = await Users.findOne({ email }); //findOne match email from mongoDB
      if (!user) return res.status(400).json({ msg: resMsg.emailNotExist }); // email doesn't exist on mongodb

      const access_token = createAccessToken({ id: user._id }); // create access_token
      const url = `${CLIENT_URL}/user/reset/${access_token}`; // url reset password

      sendEmail(email, url, "Reset your password"); // send email to user who forgot the password
      res.json({ msg: resMsg.resendPassCheckEmail }); // response email abaut reset pass has been sent to his/her email
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/forgot
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { password } = req.body; // set value of pass from req.body.password
      // console.log(password); // check value of password
      const passwordHash = await bcrypt.hash(password, 12); //hash the new password

      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          password: passwordHash,
        }
      ); // find a user and update a password from mongodb

      res.json({ msg: resMsg.changePassSuccess }); // a password successfully changed
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/reset
    }
  },
  getUserInfor: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id).select("-password"); // get all data from user except his/her pass

      res.json(user); //response user data
    } catch (err) {
      return res.status(500).json({ msg: err.message }); //something  wrong on route user/infor
    }
  },
  getUsersAllInfor: async (req, res) => {
    try {
      const users = await Users.find().select("-password"); // get all user and his/her data except pass

      res.json(users); // response all user
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/all_infor
    }
  },
  logout: async (req, res) => {
    try {
      res.clearCookie("refreshtoken", { path: "/user/refresh_token" }); // clear refresh token on cookie before logout
      return res.json({ msg: resMsg.logout }); // logout successfully
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // somethingwrong on route user/logout
    }
  },
  updateUser: async (req, res) => {
    try {
      const { name, avatar } = req.body; // set value name, avatar by req.body.name/avatar
      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          name,
          avatar,
        }
      ); // find a match from payload access token then update name and avatar

      res.json({ msg: resMsg.updateSuccess }); // update success
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/update
    }
  },
  updateUsersRole: async (req, res) => {
    try {
      const { role } = req.body; // set value role by req.body.role

      await Users.findOneAndUpdate(
        { _id: req.params.id },
        {
          role,
        }
      ); // find a match from req.params.id then update role (only role admin can do it)

      res.json({ msg: resMsg.updateSuccess }); // update role success
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route user/update_role/:id
    }
  },
  deleteUser: async (req, res) => {
    try {
      await Users.findByIdAndDelete(req.params.id); // find a match user by req.params.id and delete it (only admin can do it)

      res.json({ msg: resMsg.deleteSuccess }); // delete user successfully
    } catch (err) {
      return res.status(500).json({ msg: err.message }); //something wrong on route user/delete/:id
    }
  },
  googleLogin: async (req, res) => {
    try {
      const { tokenId } = req.body; // set value of tokenId by req.body.tokenId

      const verify = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.MAILING_SERVICE_CLIENT_ID,
      }); // get data payload from google login

      const { email_verified, email, name, picture } = verify.payload; // set data payload to spesifik value

      const password = email + process.env.GOOGLE_SECRET;

      const passwordHash = await bcrypt.hash(password, 12);

      if (!email_verified)
        return res.status(400).json({ msg: "Email verification failed." });

      const user = await Users.findOne({ email });

      if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return res.status(400).json({ msg: "Password is incorrect." });

        const refresh_token = createRefreshToken({ id: user._id });
        res.cookie("refreshtoken", refresh_token, {
          httpOnly: true,
          path: "/user/refresh_token",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ msg: "Login success!" });
      } else {
        const newUser = new Users({
          name,
          email,
          password: passwordHash,
          avatar: picture,
        });

        await newUser.save();

        const refresh_token = createRefreshToken({ id: newUser._id });
        res.cookie("refreshtoken", refresh_token, {
          httpOnly: true,
          path: "/user/refresh_token",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ msg: "Login success!" });
      }
    } catch (err) {
      return res.status(500).json({ msg: err.message });
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
