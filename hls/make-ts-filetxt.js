const fs = require("fs");
const path = require('path')



const writeTsListTxt = (num = 126) => {
  const result = []
  for (let i = 0; i < num; i++) {
    result.push(`file './${i}.ts'`)
  }

  fs.writeFileSync(path.join(__dirname, './fileList.txt'), result.join('\n'))
}
writeTsListTxt()