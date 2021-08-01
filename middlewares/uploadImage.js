const fs = require("fs");
const msgRes = require("../msgResponse");

module.exports = async function (req, res, next) {
  try {
    // no file upload
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).json({ msg: msgRes.noFileUpload });

    const file = req.files.file;

    // size file to large
    if (file.size > 1024 * 1024) {
      removeTmp(file.tempFilePath);
      return res.status(400).json({ msg: msgRes.fileSizetoLarge });
    } // 1mb

    // incorrect format file
    if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
      removeTmp(file.tempFilePath);
      return res.status(400).json({ msg: msgRes.incorrctFileFormat });
    }

    next();
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

// delete temporary File
const removeTmp = (path) => {
  fs.unlink(path, (err) => {
    if (err) throw err;
  });
};
