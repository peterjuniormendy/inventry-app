const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const Token = require("../models/tokenModel");

// generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// register user
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, photo, bio } = req.body;

  // validation
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  if (password.length > 23) {
    res.status(400);
    throw new Error("Password must not be more than 23 characters");
  }

  // Check if user email already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("Email already in use");
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password,
    photo,
    bio,
  });

  // Generate token
  const token = generateToken(user._id);

  // Send HTTP-only cookie
  res.cookie("token", token, {
    httpOnly: true,
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day NOTE: expires is the same as maxAge.
    // maxAge: 1 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    secure: true,
  });

  // send user details
  if (user) {
    const { _id, name, email, photo, bio } = user;
    res.status(201).json({
      _id,
      name,
      email,
      photo,
      bio,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // validate request
  if (!email || !password) {
    res.status(400);
    throw new Error("Please enter email and password");
  }

  // check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // check if password is correct
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // generate token
  const token = generateToken(user._id);

  // Send HTTP-only cookie
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 1 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    secure: true,
  });

  if (user && isMatch) {
    const { _id, name, email, photo, bio } = user;
    res.status(200).json({
      _id,
      name,
      email,
      photo,
      bio,
      token,
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// logout user
const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
});

// get user data
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  // save user
  if (user) {
    const { _id, name, email, photo, bio } = user;
    res.status(200).json({
      _id,
      name,
      email,
      photo,
      bio,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// get login status
const loginStatus = asyncHandler(async (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.json(false);
  }

  const verified = jwt.verify(token, process.env.JWT_SECRET);

  if (verified) {
    return res.json(true);
  }
  return res.json(false);
});

// update user details
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const { name, photo, bio, phone } = req.body;

    user.name = name || user.name;
    user.photo = photo || user.photo;
    user.bio = bio || user.bio;
    user.phone = phone || user.phone;

    const updatedUser = await user.save();
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      photo: updatedUser.photo,
      bio: updatedUser.bio,
      phone: updatedUser.phone,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// change password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, password } = req.body;
  const user = await User.findById(req.user._id);

  // check if user exist
  if (!user) {
    res.status(404);
    throw new Error("User not found, please signin");
  }

  // check if old password and password is not empty
  if (!oldPassword || !password) {
    res.status(400);
    throw new Error("Old password and new password is required");
  }

  // check if old password and password are the same
  if (oldPassword === password) {
    res.status(400);
    throw new Error("Old password and new password cannot be the same");
  }

  // compare old password and that in the DB
  const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);

  if (user && isMatch) {
    user.password = password;
    await user.save();
    res.status(200).json({ message: "Password updated successfully" });
  } else {
    res.status(401);
    throw new Error("Invalid credentials");
  }
});

// forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Delete any token associated to this user in the DB

  let token = await Token.findOne({ userId: user._id });
  if (token) {
    await token.deleteOne();
  }

  // create reset token
  let resetToken = crypto.randomBytes(32).toString("hex") + user._id;

  console.log("token", resetToken);

  // hash token
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // save token to DB
  await new Token({
    userId: user._id,
    token: hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // fifteen minutes.
  }).save();

  // construct a reset url
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  // reset email
  const message = `
  <h2>Hello ${user.name}</h2>
  <p>Please click the url below to reset your password</p>
  <p>This reset link is valid for only 15minutes</p>

  <a href=${resetUrl} clicktracking=off>${resetUrl}</a>

  <p>Regarts...</p>
  <p>Mighty</p>
  `;

  const subject = "Password Reset Request";
  const send_to = user.email;
  const send_from = process.env.EMAIL_USERNAME;

  try {
    await sendEmail(subject, message, send_to, send_from);
    res
      .status(200)
      .json({ success: true, message: "Email sent successfully!!!" });
  } catch (error) {
    res.status(500);
    throw new Error("Error sending email");
  }
});

// reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;

  // hash and compare the resetToken to the one in the DB

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const token = await Token.findOne({
    token: hashedToken,
    expiresAt: { $gt: Date.now() },
  });

  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid reset token" });
  }

  // Find user
  const user = await User.findOne({ _id: token.userId });

  user.password = password;
  await user.save();
  res.status(200).json({ message: "Password updated successfully" });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUser,
  loginStatus,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
};
