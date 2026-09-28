import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "assets", "icon.svg"));
const image = await loadImage(source);
const canvas = createCanvas(256, 256);
canvas.getContext("2d").drawImage(image, 0, 0, 256, 256);
const png = canvas.toBuffer("image/png");

// Windows accepts PNG-compressed icon frames for 256×256 app icons.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // ICO resource type
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(0, 6); // width 256
header.writeUInt8(0, 7); // height 256
header.writeUInt8(0, 8); // palette count
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
await writeFile(path.join(root, "assets", "icons", "icon.ico"), Buffer.concat([header, png]));
process.stdout.write("Created assets/icons/icon.ico (256×256)\n");
