require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");
 
const app = express();
 
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
 
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_DB_URL);

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
passport.deserializeUser(function(id, done){
    User.findById(id, function(err, user){
        done(err,user);
    })
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://secrets-project.fly.dev/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.CLIENT_ID_FB,
    clientSecret: process.env.CLIENT_SECRET_FB,
    callbackURL: "https://secrets-project.fly.dev/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res) {
    res.render("home");
});

app.get("/auth/google", passport.authenticate('google', {
    scope: ['profile']
}));

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
});

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  });


app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function(req, res) {
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
        if (!err) {
            if (foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    })
})

app.get("/submit", function(req, res) {
    if(req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login");
    }
})

app.post("/submit", function(req, res) {
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, function(err, foundUser){
        if (!err) {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");
                })
            }
        }
    })
})

app.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
      }
    res.redirect('/');
  });
});

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            })
        }
    })
});

app.post('/login',

  passport.authenticate('local', { failureRedirect: '/login' }),

  function(req, res) {

    res.redirect('/secrets');

});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
 
app.listen(port, function() {
    console.log("Server started on port 3000.");
});