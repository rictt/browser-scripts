async function getImageList() {
  const imgList = Array.from(document.querySelectorAll('img'))
  const result = []
  for (const img of imgList) {
    const source = await getImageDimensions(img.src, img)
    result.push(source)
  }
  
  return result
}

function getBgImgs(doc) {
  const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i;
  // 返回从文档中查询到的所有DOM元素的结果。
  return Array.from(
    Array.from(doc.querySelectorAll('*')) // 查询文档中的所有DOM元素。
      .reduce((collection, node) => {     // 使用reduce方法，将所有背景图片的URL聚合到一个Set中，以消除重复项。
        // 使用window.getComputedStyle方法获取节点的所有计算后的CSS样式。
        let prop = window.getComputedStyle(node, null)
          .getPropertyValue('background-image'); // 从样式中获取background-image属性值。
        let match = srcChecker.exec(prop);      // 使用正则表达式匹配background-image的属性值。
        if (match) {
          collection.push({
            src: match[1],
            node: node,
          })             
        }
        return collection;              
      }, [])                             
  );
}

async function loadImage (src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const width = img.width
      const height = img.height
      resolve({ width, height })
    }
    img.onerror = (error) => {
      reject(error)
    }
    img.src = src
  })
}

async function getImageDimensions(src, node) {
  const source = {
    src: src,
    renderWidth: 0,
    renderHeight: 0,
    message: ''
  }
  try {
    if (node) {
      source.renderWidth = node.offsetWidth
      source.renderHeight = node.offsetHeight
    }
    const { width, height } = await loadImage(src)
    source.width = width
    source.height = height
  } catch (error) {
    source.message = typeof error === 'object' ? JSON.stringify(error) : message
  }
  return source
}

async function start () {
  const bgImages = getBgImgs(document)
  const allBgImages = []
  for (const img of bgImages) {
    allBgImages.push(await getImageDimensions(img.src, img.node))
  }
  console.log(allBgImages)
  const imgList = await getImageList()
  const totals = [...allBgImages, ...imgList]
  const map = new Map()
  const result = []

  totals.forEach(item => {
    if (map.get(item.src)) {
      return
    }
    map.set(item.src, item)
    result.push(item)
  })

  console.log('finally: ', result, result.length)


  const html = STATIC_HTML.replace('{{tableData}}', JSON.stringify(result))
  writeToHTML(html)
}

function writeToHTML(html) {
  const url = window.URL.createObjectURL(
    new Blob([html])
  );
  const a = document.createElement("a");
  
  a.href = url;
  a.download = "file.html";
  a.click();
  window.URL.revokeObjectURL(url);
}

const CDN = {
  ELE_CSS: `https://cdn.staticfile.org/element-ui/2.15.14/theme-chalk/index.min.css`,
  ELE_JS: `https://cdn.staticfile.org/element-ui/2.15.14/index.min.js`,
  VUE_JS: `https://cdn.bootcdn.net/ajax/libs/vue/2.6.13/vue.min.js`
}

const STATIC_HTML = `
<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="${CDN.ELE_CSS}">
</head>

<body>
  <div id="app">
    加载成功
    <el-table :data="tableData" border style="width: 100%" size="mini">
      <el-table-column prop="src" label="图片">
        <template #default="{ row }">
          <a :href="row.src" target="_blank" >
            <img :src="row.src" style="display: block; max-width: 100%;" />
          </a>
        </template>
      </el-table-column>
      <el-table-column prop="src" label="图片地址">
        <template #default="{ row }">
          <el-link :href="row.src" target="_blank" size="mini">点击查看</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="renderWidth" label="图片尺寸(宽高)">
        <template #default="{ row }">
          {{ row.renderWidth }} x {{ row.renderHeight }}
        </template>
      </el-table-column>
      <!-- <el-table-column prop="width" label="页面尺寸(宽高)">
        <template #default="{ row }">
          {{ row.width }} x {{ row.height }}
        </template>
      </el-table-column> -->
      <el-table-column prop="width" label="宽高比">
        <template #default="{ row }">
          {{ row.renderWidth ? (row.renderWidth / row.renderHeight).toFixed(2) : '' }}
        </template>
      </el-table-column>
      <el-table-column prop="message" label="其他">
        <template #default="{ row }">
          {{ row.message || '-' }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</body>
<!-- import Vue before Element -->
<script src="${CDN.VUE_JS}"></script>
<!-- import JavaScript -->
<script src="${CDN.ELE_JS}"></script>
<script>
  const tableData = {{tableData}}
  new Vue({
    el: '#app',
    data: function () {
      return {
        visible: false,
        tableData: tableData
      }
    }
  })

</script>

</html>

`