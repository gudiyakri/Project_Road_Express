const nodemailer = require("nodemailer");

const { EMAIL, PASS } = require("../utils/Constant");

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.in",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL,
    pass: PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error(error);
  else console.log(`Success`);
});

module.exports = {
  sendMail: async (recipient, subject, body) => {
    try {
      let options = {
        from: `CB ${EMAIL}`, // sender address
        to: recipient, // list of receivers
        priority: "high",
        subject: subject,
        html: body,
      };

      transporter.sendMail(options, (error, info) => {
        if (error) console.error(error);

        console.log(info.messageId);
      });

      // console.log("Message sent: %s", info.messageId);
    } catch (error) {
      console.log(error);
    }
  },
  sendReport: async (recipient) => {
    try {
      let transporter = nodemailer.createTransport({
        host: "smtp.hostinger.in",
        port: 587,
        secure: false,
        auth: {
          user: email,
          pass: pass,
        },
      });

      transporter.verify((error) => {
        if (error) console.error(error);
        else console.log(`Success`);
      });

      let options = {
        from: `"DST" ${email}`, // sender address
        to: recipient, // list of receivers
        priority: "high",
        subject: "Reports",
        html: `<h4>Please find in the reports in the below attachments</h4>`,
        attachments: [
          {
            // filename and content type is derived from path
            path: "../public/pdf/Report.pdf",
          },
        ],
      };

      transporter.sendMail(options, (error, info) => {
        if (error) console.error(error);

        console.log(info.messageId);
      });

      // console.log("Message sent: %s", info.messageId);
    } catch (error) {
      console.log(error);
    }
  },
};
