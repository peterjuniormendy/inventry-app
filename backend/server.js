const dotenv = require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

// Custom request error handler
const requestError = require("./middleware/errorMiddleware");

// App routes
const userRoute = require("./routes/userRoute");

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded({ extended: false }));

// Routes middleware
app.use("/api/users", userRoute);

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Request Error middleware
app.use(requestError);

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

if (!DB_URI) {
  throw new Error("DB_URI environment variable is not set");
}

// CONNECT TO DB AND START SERVER
mongoose
  .connect(DB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
