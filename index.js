// 接收一个上传的webm文件，使用@ffmpeg/ffmpeg把它转换为mp4文件，存储在当前目录。使用formidable处理请求数据。
import path from "path";
import { promises as fsp } from 'fs';
import fs from "fs";
import { exec } from "child_process";
import express from 'express';
import formidable from 'formidable';

const app = express();
const PORT = 8093;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const outDir = 'converted'

// make outDir if not exists
await fsp.mkdir(outDir, { recursive: true });

app.get('/webm2mp4', (req, res) => {
  const { filename } = req.query;
  const { download } = req.query;
  const file = path.join(process.cwd(), outDir, filename);
  const stream = fs.createReadStream(file);
  stream.on('error', (err) => {
    console.error(err);
    res.status(500).end();
  });

  res.setHeader('Content-Disposition', `attachment; filename = ${download} `);
  res.setHeader('Content-Type', 'video/mp4');
  stream.pipe(res);
})

app.options('/webm2mp4', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send('')
})

app.post('/webm2mp4', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  deleteOldFiles(outDir)
  try {
    const form = formidable({ multiples: false });
    const { fields, files } = await new Promise((resolve, reject) => {
      let r
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else {
          r = { fields, files }
        }
      });
      form.once('error', reject);
      form.once('end', () => {
        resolve(r)
      });
    });
    const file = files.file;

    // make dir if not exists
    await fsp.mkdir(outDir, { recursive: true });

    // convert to mp4
    const tmpName = path.join(outDir, path.basename(file.filepath) + '.webm');
    const outputName = path.join(outDir, generateFileName());
    fs.renameSync(file.filepath, tmpName)
    const execCMD = () => {
      if (fs.existsSync(outputName)) {
        fs.unlinkSync(outputName);
      }
      return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${tmpName} -c:v libx264 -an ${outputName}`, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        });
      })
    }
    // try twice
    let t = await execCMD();
    if (t.error) {
      t = await execCMD();
    }
    // 
    if (t.error) {
      const { error, stdout, stderr } = t
      console.error(`ffmpeg error：${error} `);
      console.log(`stdout: ${stdout} `);
      console.error(`stderr: ${stderr} `);
      throw error
    }
    res.status(200).json({ success: true, filename: path.basename(outputName) });
  } catch (err) {
    console.error(err);
    res.status(500).end('Internal Server Error');
  }
});

const generateFileName = () => {
  const date = new Date();
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${dateString}-${randomString}.mp4`;
};

const deleteOldFiles = (directoryPath) => {
  const TEN_DAYS_IN_MILLISECONDS = 10 * 24 * 60 * 60 * 1000;
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error(err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      const stats = fs.statSync(filePath);
      const fileAgeInMilliseconds = Date.now() - stats.birthtimeMs;

      if (fileAgeInMilliseconds > TEN_DAYS_IN_MILLISECONDS) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log(`Deleted file: ${filePath} `);
          }
        });
      }
    });
  });
};

app.listen(PORT, HOST, () => {
  console.log(`Server started on port ${PORT}`);
});
