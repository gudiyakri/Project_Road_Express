const http = require("http");

const { AUTHKEY } = require("../utils/Constant");

module.exports = {
  messenger: async (message, phone) => {
    try {
      const msg = encodeURIComponent(message);
      const url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=TESTIN&mobiles=${phone}&authkey=${AUTHKEY}&message=${msg}`;

      http
        .get(url, function (resp) {
          resp.on("data", function (chunk) {
            console.log(chunk);
          });
        })
        .on("error", function (e) {
          console.log("Got error: " + e.message);
        });
    } catch (error) {
      console.log(error);
      return 0;
    }
  },
  generate: (lenght = 4) => {
    try {
      const string = "123456789";
      let OTP = "";
      const len = string.length;
      for (let i = 0; i < lenght; i++) {
        OTP += string[Math.floor(Math.random() * len)];
      }
      return OTP;
    } catch (error) {
      console.log(error);
      throw error;
    }
  },
  getTemplate: async (
    fitsapptemplate,
    application,
    TemplateCode,
    app = "Customer"
  ) => {
    try {
      const applicationId = await application.findOne({
        where: {
          Name: app,
        },
      });
      const data = await fitsapptemplate.findOne({
        where: {
          Status: 0,
          TemplateCode: TemplateCode,
          ApplicationID: applicationId.dataValues.ApplicationID,
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  },
};
