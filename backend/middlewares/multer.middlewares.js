import multer from "multer";
import fs from 'fs';


const storage = multer.diskStorage({
// Create uploads directory if it doesn't exist
destination: function (req, file, cb) {
    if (!fs.existsSync('./public')) {
      fs.mkdirSync('./public');
    }
    if (!fs.existsSync('./public/uploads')) {
      fs.mkdirSync('./public/uploads');
    }
    // This storage needs public/images folder in the root directory
    // Else it will throw an error saying cannot find path public/images
    cb(null, "./public/uploads");
  },
  // Store file in a .png/.jpeg/.jpg format instead of binary
  filename: function (req, file, cb) {
    let fileExtension = "";
    if (file.originalname.split(".").length > 1) {
      fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf(".")
      );
    }
    const filenameWithoutExtension = file.originalname
      .toLowerCase()
      .split(" ")
      .join("-")
      ?.split(".")[0];
    cb(
      null,
      filenameWithoutExtension +
        Date.now() +
        Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
        fileExtension
    );
  },
});

// Middleware responsible to read form data and upload the File object to the mentioned path
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 3000 * 3000,
  },
});
