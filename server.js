const express = require("express");
const app = express();
const port = 3000;
const axios = require("axios");
const Jimp = require("jimp");
var cors = require("cors");

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    origin: "*",
  })
);
Array.prototype.random = function () {
  return this[Math.floor(Math.random() * this.length)];
};
const currentTime = () => {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  return (
    day + "-" + month + "-" + year + "-" + hours + "-" + minutes + "-" + seconds
  );
};
const randomPoint = async () => {
  let p100, p70, p150;
  p100 = await Jimp.read("./points/100.png");
  p70 = await Jimp.read("./points/70.png");
  let files = [{ im: p100, size: 80 }];
  return files.random();
};
async function predict(options) {
  let prompt = options.prompt || "fatih sultan mehmet",
    sampler = options.sampler || "Euler a",
    steps = options.steps || 20,
    seed = options.seed || -1,
    w = options.w || 512,
    h = options.h || 512,
    tiling = options.tiling || false;
  const json = JSON.stringify({
    txt2imgreq: {
      prompt,
      steps,
      sampler_name: sampler,
      seed,
      width: w,
      height: h,
      tiling,
    },
  });
  const predict = await axios.post("http://127.0.0.1:7860/v1/txt2img", json, {
    headers: {
      // Overwrite Axios's automatically set Content-Type
      "Content-Type": "application/json",
    },
  });
  let { images } = predict.data;
  let saveImg = await Jimp.read(Buffer.from(images[0], "base64"));

  saveImg.write("./outputs/" + prompt + "_" + predict.data.seed + ".png");
  return images[0];
}

//TO-DO Post endpoint with all available options
app.post("/txt2img", async (req, res) => {
  let { prompt, steps, sampler_name, seed, width, height, tiling } = req.body;
  let result = await predict({
    prompt,
    steps,
    sampler_name,
    seed,
    width,
    height,
    tiling,
  });
  res.json({ image: result });
});
app.post("/createmask", async (req, res) => {
  let base64 = req.body.base64;
  let w, h;
  let image = await Jimp.read(Buffer.from(base64, "base64"));

  w = image.bitmap.width; //  width of the image
  h = image.bitmap.height;
  let pointCloud = [];

  for (let x = 0; x < w; x++) {
    let latest;
    for (let y = 0; y < h; y++) {
      let colr = image.getPixelColor(x, y);
      let colorRgba = Jimp.intToRGBA(colr);

      let { r, g, b, a } = colorRgba;
      if (r < 1 && g < 1 && b < 1) {
        let clr = Jimp.rgbaToInt(255, 255, 255, 255);
        image.setPixelColor(clr, x, y);
      } else {
        let clr = Jimp.rgbaToInt(1, 1, 1, 255);
        image.setPixelColor(clr, x, y);
      }
      // X SATIRI
      colr = image.getPixelColor(x, y);
      colorRgba = Jimp.intToRGBA(colr);

      r = colorRgba.r;
      g = colorRgba.g;
      b = colorRgba.b;
      a = colorRgba.a;
      let sum = r + g + b + a;
      if (sum == latest) {
      } else {
        latest = sum;
        if (x > 1 && y > 1 && x < 512 && y < 512 && x % 15 == 0) {
          // let randomimage = random([p90, p75, p55]);
          //let clr = Jimp.rgbaToInt(221, 11, 251, 255);
          //image.setPixelColor(clr, x, y);
          pointCloud.push({ x, y });
        }
      }
    }
  }
  //Y SATIRI
  for (let y = 0; y < h; y++) {
    let latest;
    for (let x = 0; x < w; x++) {
      let colr = image.getPixelColor(x, y);
      let colorRgba = Jimp.intToRGBA(colr);

      let { r, g, b, a } = colorRgba;

      let sum = r + g + b + a;
      if (sum == latest) {
      } else {
        latest = sum;
        if (x > 1 && y > 1 && x < 512 && y < 512 && y % 15 == 0) {
          // let randomimage = random([p90, p75, p55]);
          //  let clr = Jimp.rgbaToInt(221, 11, 251, 255);
          pointCloud.push({ x, y });
          //image.setPixelColor(clr, x, y);
        }
      }
    }
  }

  //KOYMA ZAMANI
  for (const point of pointCloud) {
    let p = await randomPoint();
    let { x, y } = point;
    image.composite(p.im, x - p.size * 0.7, y - p.size * 0.7);
  }
  let bff = await new Promise((resolve, reject) => {
    image.getBuffer(Jimp.MIME_PNG, (error, buffer) =>
      error ? reject(error) : resolve(buffer)
    );
  });
  console.log("done");

  image.getBase64(Jimp.AUTO, (err, base64) => {
    res.json({ mask: base64.split(",")[1] });
  });

  //   res.writeHead(200, {
  //     "Content-Type": "image/jpg",
  //     "Content-Length": bff.length,
  //   });
  //   res.end(bff);
});
app.post("/outpaint", async (req, res) => {
  let image = req.body.image;
  let prompt = req.body.prompt;
  let maskRequest = await axios.post(
    "http://localhost:3000/createmask",
    { base64: image },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  let { mask } = maskRequest.data;
  //Save Image and Mask Images for Development Purposes
  let originalImageSave = await Jimp.read(Buffer.from(image, "base64"));
  let fileName = currentTime();
  console.log(fileName);
  originalImageSave.write(
    "./outputs/crop_im_" + prompt + "_" + fileName + ".png"
  );
  let maskImageSave = await Jimp.read(Buffer.from(mask, "base64"));
  maskImageSave.write("./outputs/mask_im_" + prompt + "_" + fileName + ".png");
  console.log("Img2Img Prompt " + prompt);
  let img2imgJson = JSON.stringify({
    img2imgreq: {
      prompt,
      image,
      mask_image: mask,
      mask_blur: 8,
      steps: 30,
      batch_size: 3,
      sampler_name: "Euler a",
      inpainting_fill: "fill",
    },
  });

  const predict = await axios.post(
    "http://127.0.0.1:7860/v1/img2img",
    img2imgJson,
    {
      headers: {
        // Overwrite Axios's automatically set Content-Type
        "Content-Type": "application/json",
      },
    }
  );

  res.json(predict.data);
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
