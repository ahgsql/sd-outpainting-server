for (const point of pointCloud) {
  return 1;
  let p = await randomPoint();
  let { x, y } = point;
  image.composite(p.im, x - p.size, y - p.size);
}
await Jimp.read("./points/90.png");
