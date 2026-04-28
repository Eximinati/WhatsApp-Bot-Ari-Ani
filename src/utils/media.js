const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

function createTempPath(extension) {
  return path.join(
    os.tmpdir(),
    `ari-ani-${crypto.randomBytes(8).toString("hex")}.${extension}`,
  );
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function downloadMessageBuffer(message) {
  const source = message.msg || message;
  const mime = source.mimetype || "";
  const messageType = message.mtype
    ? message.mtype.replace(/Message/gi, "")
    : mime.split("/")[0];

  const stream = await downloadContentFromMessage(
    source,
    messageType
  );

  return streamToBuffer(stream);
}

async function createStickerFromMessage(message, options) {
  const buffer = await downloadMessageBuffer(message);

  const sticker = new Sticker(buffer, {
    type: StickerTypes.FULL,
    quality: 80,
    background: "transparent",
    ...options,
  });

  return sticker.toBuffer();
}

function convertWebpToPngBuffer(buffer) {
  return new Promise(async (resolve, reject) => {
    const inputPath = createTempPath("webp");
    const outputPath = createTempPath("png");

    try {
      await fs.writeFile(inputPath, buffer);

      ffmpeg(inputPath)
        .outputOptions("-frames:v 1")
        .save(outputPath)
        .on("end", async () => {
          try {
            const output = await fs.readFile(outputPath);
            resolve(output);
          } catch (error) {
            reject(error);
          } finally {
            await Promise.allSettled([
              fs.unlink(inputPath),
              fs.unlink(outputPath)
            ]);
          }
        })
        .on("error", async (error) => {
          await Promise.allSettled([
            fs.unlink(inputPath),
            fs.unlink(outputPath)
          ]);
          reject(error);
        });

    } catch (error) {
      await Promise.allSettled([
        fs.unlink(inputPath),
        fs.unlink(outputPath)
      ]);
      reject(error);
    }
  });
}

function mediaInput(data) {
  return Buffer.isBuffer(data)
    ? data
    : typeof data === "string"
    ? { url: data }
    : data;
}

async function getAudioBuffer(url) {
  const res = await axios.get(url,{
    responseType:"arraybuffer"
  });

  return Buffer.from(res.data);
}

async function sendVideoMessage(
  conn,
  from,
  url,
  M
){
  return conn.sendMessage(
    from,
    {
      video: mediaInput(url),
      caption: "> Developed By *Deryl*",
    },
    { quoted:M }
  );
}

async function sendAudioMessage(
  conn,
  from,
  url,
  M,
  ppt=false,
  contextInfo={}
){

  if (
    typeof url==="string" &&
    /^https?:\/\//.test(url)
  ){
    url = await getAudioBuffer(url);
  }

  return conn.sendMessage(
    from,
    {
      audio: mediaInput(url),
      mimetype:"audio/mpeg",
      ptt:ppt,
      contextInfo:{
        ...contextInfo
      }
    },
    { quoted:M }
  );
}

async function sendDocumentMessage(
  conn,
  from,
  url,
  M
){
  return conn.sendMessage(
    from,
    {
      document: mediaInput(url),
      caption: "> Developed By *Deryl*",
      mimetype:"application/pdf",
      fileName:`${Date.now()}.pdf`
    },
    { quoted:M }
  );
}

module.exports = {
  convertWebpToPngBuffer,
  createStickerFromMessage,
  downloadMessageBuffer,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage
};
