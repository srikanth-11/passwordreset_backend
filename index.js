require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const shortid = require("shortid");
const dns = require("dns");
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const cors = require("cors");
const valid_url = require("valid-url");
const bycrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");


const app = express();
const url =
  "mongodb+srv://srikanth:srikanth@11@short.m1jiw.mongodb.net/short?retryWrites=true&w=majority";
const dbName = "short";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: "https://adoring-ptolemy-1b26f7.netlify.app",
  })
);
const origin = "https://adoring-ptolemy-1b26f7.netlify.app";

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLEINT_SECRET,
  process.env.REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

app.post("/login", async (req, res) => {
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    let db = connection.db(dbName);
    let user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      let isUserAuthenticated = await bycrypt.compare(
        req.body.password,
        user.password
      );
      if (isUserAuthenticated) {
        res.json({
          message: "User Authenticated Successfully",
          email: req.body.email,
        });
      } else {
        res.status(400).json({
          message: "Password is wrong for the provided email",
        });
      }
    } else {
      res.status(400).json({
        message: "Entered Email does not exists",
      });
    }
  } catch (err) {
    res.status(400).json({
      message: "Unable to login please enter valid credentials",
    });
  } finally {
    connection.close();
  }
});

app.post("/sign_up", async (req, res) => {
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    let db = connection.db(dbName);
    let user1 = await db.collection("users").findOne({ email: req.body.email });
    if (user1) {
      res.json({
        message: "user Already exists",
      });
    } else {
      let salt = await bycrypt.genSalt(10);
      let hash = await bycrypt.hash(req.body.password, salt);
      req.body.password = hash;
      await db
        .collection("users")
        .insertOne({ email: req.body.email, password: req.body.password });

      async function sendMail() {
        try {
          const accessToken = await oAuth2Client.getAccessToken();

          const transport = nodemailer.createTransport({
            service: "gmail",
            auth: {
              type: "OAuth2",
              user: "kasireddysrikanth27@gmail.com",
              clientId: process.env.CLIENT_ID,
              clientSecret: process.env.CLEINT_SECRET,
              refreshToken: process.env.REFRESH_TOKEN,
              accessToken: accessToken,
            },
          });

          let mailBody = `<div>
    <h3> successfully registered </h3>
    <p>Please click the given link to login <a target="_blank" href="${origin}/index.html"> click here </a></p>
</div>`;

          const mailOptions = {
            from: "url-shortner <kasireddysrikanth27@gmail.com>",
            to: req.body.email,
            subject: "Registration",
            text: "urlshortner",
            html: mailBody,
          };

          const result = await transport.sendMail(mailOptions);
          return result;
        } catch (error) {
          return error;
        }
      }

      sendMail()
        .then((result) => console.log("Email sent...", result))
        .catch((error) => console.log(error.message));

      res.json({
        message: "User Registered Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Unable to register please enter valid details",
    });
  } finally {
    connection.close();
  }
});

app.post("/forget-password", async (req, res) => {
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    let db = connection.db(dbName);
    let user = await db.collection("users").findOne({ email: req.body.email });

    if (user) {
      // let token = await crypto.randomBytes(20);
      let token = shortid.generate();

      console.log("forgot", token);
      console.log(user);
      await db
        .collection("users")
        .updateOne(
          { _id: user._id },
          {
            $set: { resetToken: token, resetTokenExpires: Date.now() + 300000 },
          }
        );

      let mailBody = `<div>
                <h3>Reset Password</h3>
                <p>Please click the given link to reset your password <a target="_blank" href="${origin}/resetpassword.html?key=${encodeURIComponent(
        token
      )}"> click here </a></p>
            </div>`;

      async function sendMail() {
        try {
          const accessToken = await oAuth2Client.getAccessToken();

          const transport = nodemailer.createTransport({
            service: "gmail",
            auth: {
              type: "OAuth2",
              user: "kasireddysrikanth27@gmail.com",
              clientId: process.env.CLIENT_ID,
              clientSecret: process.env.CLEINT_SECRET,
              refreshToken: process.env.REFRESH_TOKEN,
              accessToken: accessToken,
            },
          });

          const mailOptions = {
            from: "url-shortner <kasireddysrikanth27@gmail.com>",
            to: req.body.email,
            subject: "Password reset",
            text: "urlshortner",
            html: mailBody,
          };

          const result = await transport.sendMail(mailOptions);
          return result;
        } catch (error) {
          return error;
        }
      }

      sendMail()
        .then((result) => console.log("Email sent...", result))
        .catch((error) => console.log(error.message));

      res.json({
        message: "Email sent",
      });
    } else {
      res.json({
        message: "Email not sent",
      });
    }
  } catch (err) {
    console.log(err);
  } finally {
    connection.close();
  }
});

app.put("/reset", async (req, res) => {
  console.log("reset", decodeURIComponent(req.body.token));
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    let db = connection.db(dbName);

    let user = await db
      .collection("users")
      .findOne({
        resetToken: decodeURI(req.body.token),
        resetTokenExpires: { $gt: Date.now() },
      });
    console.log(user);
    if (user) {
      let salt = await bycrypt.genSalt(10);
      console.log(req.body.password);
      let password = await bycrypt.hash(req.body.password, salt);
      console.log(password);
      let updateInfo = await db
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { password: password } });

      if (updateInfo.modifiedCount > 0) {
        await db
          .collection("users")
          .updateOne(
            { _id: user._id },
            { $set: { resetToken: "", resetTokenExpires: "" } }
          );

        async function sendMail() {
          try {
            const accessToken = await oAuth2Client.getAccessToken();

            const transport = nodemailer.createTransport({
              service: "gmail",
              auth: {
                type: "OAuth2",
                user: "kasireddysrikanth27@gmail.com",
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLEINT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: accessToken,
              },
            });

            let mailBody = `<div>
                <h3> Password reset successful </h3>
                <p>Please click the given link to login <a target="_blank" href="${origin}/index.html"> click here </a></p>
            </div>`;

            const mailOptions = {
              from: "url-shortner <kasireddysrikanth27@gmail.com>",
              to: user.email,
              subject: "Password reset",
              text: "urlshortner",
              html: mailBody,
            };

            const result = await transport.sendMail(mailOptions);
            return result;
          } catch (error) {
            return error;
          }
        }

        sendMail()
          .then((result) => console.log("Email sent...", result))
          .catch((error) => console.log(error.message));
      }
      res.status(200).json({
        message: "password reset succesfull",
      });
    } else {
      res.json({
        message: "user with valid token is not found",
      });
    }
  } catch (err) {
    console.log(err);
  } finally {
    connection.close();
  }
});

app.listen(process.env.PORT || 3000);
