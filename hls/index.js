const fs = require("fs");
const source = fs.readFileSync("./index.m3u8", "utf-8");
const request = require("request");
const path = require('path')

const sourceArray = source.split("\n");

const tsList = sourceArray
  .filter((item) => {
    return item.match(/\.ts$/) || item.indexOf(".ts") !== -1;
  })
  .map((e) => {
    return "https:/" + e.split("?")[0];
  });

function getFileByUrl(url, fileName, dir) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      reject()
    }, 5000)
    let stream = fs.createWriteStream(path.join(dir, fileName));
    request(url, {
      rejectUnauthorized: false
    })
      .pipe(stream)
      .on("close", function (err) {
        console.log("文件" + fileName + "下载完毕");
        clearTimeout(timer)
        resolve()
      });
  })
}

async function downloadTs() {
  const date = new Date()
  const name = path.join(__dirname, `./ts/m3u8-${date.toLocaleString().replace(/[\/\s:]/g, '')}`)
  fs.mkdirSync(name)
  const startDate = Date.now()
  const len = tsList.length
  let index = 0
  const failList = []
  console.log(`创建文件夹成功：${name}`)
  console.log('等待下载ts文件数：', len)
  function download() {
    const ts = tsList[index++]
    const fileName = index + '.ts'
    console.log('正在下载ts文件：', fileName)
    getFileByUrl(ts, fileName, name)
      .catch(() => {
        console.log(`下载${fileName}失败`)
        failList.push({
          fileName,
          url: ts,
        })
      })
      .finally(() => {
        if (index >= len) {
          const diff = Date.now() - startDate
          console.log("失败列表：", failList)
          console.log("下载总耗时：", Math.floor(diff / 1000) + 's')
          return
        }
        download()
      })
  }

  download()
  // for (let i = 0; i < len; i++) {
  //   const ts = tsList[i]
  //   const fileName = i + 1 + '.ts'
  //   getFileByUrl(ts, fileName, name)
  // }
}

// downloadTs()

const writeTsListTxt = (num = 221) => {
  const result = []
  for (let i = 1; i <= num; i++) {
    result.push(`file './${i}.ts'`)
  }

  fs.writeFileSync(path.join(__dirname, './fileList.txt'), result.join('\n'))
}
writeTsListTxt()