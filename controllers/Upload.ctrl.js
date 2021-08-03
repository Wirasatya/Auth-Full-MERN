const cloudinary = require("cloudinary");
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const uploadCtrl = {
  uploadAvatar: (req, res) => {
    try {
      const file = req.files.file; // set value of file by req.files.file

      cloudinary.v2.uploader.upload(
        file.tempFilePath,
        {
          folder: "authentication/profile_picture",
          width: 150,
          height: 150,
          crop: "fill",
        }, // upload file to cloudinary and save file to folder authentication/profile_picture
        async (err, result) => {
          if (err) throw err;

          removeTmp(file.tempFilePath); // remove temp file on local storage

          res.json({ url: result.secure_url }); // set url image from cloudinary
        }
      );
    } catch (err) {
      return res.status(500).json({ msg: err.message }); // something wrong on route api/upload_avatar
    }
  },
};

const removeTmp = (path) => {
  fs.unlink(path, (err) => {
    if (err) throw err;
  });
};

module.exports = uploadCtrl;
