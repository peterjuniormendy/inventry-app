const nodemailer = require("nodemailer");

const sendEmail = async (subject, message, send_from, send_to, reply_to) => {
  // create email transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // define email options
  const mailOptions = {
    from: send_from,
    to: send_to,
    subject: subject,
    html: message,
    replyTo: reply_to,
  };

  //   send email
  await transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

module.exports = sendEmail;
