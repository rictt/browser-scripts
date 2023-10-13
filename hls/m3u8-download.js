// ==UserScript==
// @name         医学网m3u8资源下载
// @namespace    http://tampermonkey.net/
// @description  医学网m3u8资源下载
// @version      0.1
// @author       You
// @require      https://cdn.bootcdn.net/ajax/libs/m3u8-parser/7.1.0/m3u8-parser.js
// @match        https://**/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=alibaba.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_removeValueChangeListener
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==


(function () {
  function rewriteRequest() {
    const originOpen = XMLHttpRequest.prototype.open;
    const intercepts = [];
    XMLHttpRequest.prototype.open = function (_, url) {
      try {
        const callbacks = intercepts.filter(e => e.condition(url))
        this.addEventListener("readystatechange", function () {
          if (this.readyState === 4) {
            callbacks.forEach(e => e.callback(this.response))
          }
        })
        originOpen.apply(this, arguments);
      } catch (error) {
        console.log(error)
      }
    };

    function registerResponseIntercept(condition, callback) {
      intercepts.push({
        condition,
        callback
      })
    }

    return {
      registerResponseIntercept
    }
  }
  const { registerResponseIntercept } = rewriteRequest()

  registerResponseIntercept((url) => url.indexOf('.m3u8') !== -1, onM3u8Response)
  registerResponseIntercept((url) => url.indexOf('getKeyForHls') !== -1, onM3u8KeyResponse)
})();


class M3u8Download {
  constructor() {
    this.tsUrlList = [] // ts URL数组
    this.finishList = []
    this.downloadIndex = 0
    this.aesConf = {
      method: '', // 加密算法
      uri: '', // key 所在文件路径
      iv: '', // 偏移值
      key: '', // 秘钥
      decryptor: null, // 解码器对象

      stringToBuffer: function (str) {
        return new TextEncoder().encode(str)
      },
    }
  }

  setAesConf({ method, uri, iv }) {
    this.aesConf.method = method
    this.aesConf.uri = uri
    this.aesConf.iv = iv
    this.aesConf.iv = this.aesConf.iv ? this.aesConf.stringToBuffer(this.aesConf) : ''
    this.aesConf.uri = this.applyURL(this.aesConf.uri, '')
  }

  applyURL(targetURL, baseURL) {
    baseURL = baseURL || ''
    if (targetURL.indexOf('http') === 0) {
      // 当前页面使用 https 协议时，强制使 ts 资源也使用 https 协议获取
      if (location.href.indexOf('https') === 0) {
        return targetURL.replace('http://', 'https://')
      }
      return targetURL
    } else if (targetURL[0] === '/') {
      let domain = baseURL.split('/')
      return (domain[0] ? domain[0] + '//' : '') + (domain[2] || '') + targetURL
    } else {
      let domain = baseURL.split('/')
      domain.pop()
      return domain.join('/') + '/' + targetURL
    }
  }

  ajax(options) {
    options = options || {};
    let xhr = new XMLHttpRequest();
    if (options.type === 'file') {
      xhr.responseType = 'arraybuffer';
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        let status = xhr.status;
        if (status >= 200 && status < 300) {
          options.success && options.success(xhr.response);
        } else {
          options.fail && options.fail(status);
        }
      }
    };

    xhr.open("GET", options.url, true);
    xhr.send(null);
  }

  downloadTs() {
    console.log('download ts')
    let download = () => {
      let index = this.downloadIndex
      let len = this.tsUrlList.length
      if (index >= len) {
        return
      }
      this.downloadIndex++
      if (this.finishList[index] && this.finishList[index].status === '') {
        this.finishList[index].status = 'downloading'
        this.ajax({
          url: this.tsUrlList[index],
          type: 'file',
          success: (file) => {
            this.dealTS(file, index, () => this.downloadIndex < this.tsUrlList.length && download())
          },
          fail: () => {
            this.finishList[index].status = 'error'
            if (this.downloadIndex < len) {
              download()
            }
          }
        })
      }
    }

    // 建立多少个 ajax 线程
    for (let i = 0; i < 6; i++) {
      download()
    }
  }



  // 处理 ts 片段，AES 解密、mp4 转码
  dealTS(file, index, callback) {
    const data = this.aesConf.uri ? this.aesDecrypt(file, index) : file
    console.log('detail ts')
    // this.downloadFile(data, index)
    // callback()
    this.conversionMp4(data, index, (afterData) => {
      // mp4轉碼
    })
  }

  conversionMp4(data, index, callback) {

  }

  downloadFile(fileData, fileName) {
    console.log(fileData)
    let a = document.createElement('a')
    let fileBlob = null
    fileBlob = new Blob([fileData], { type: 'video/MP2T' })
    a.download = fileName + '.ts'
    a.href = URL.createObjectURL(fileBlob)
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  // ts 片段的 AES 解码
  aesDecrypt(data, index) {
    let iv = this.aesConf.iv || new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, index])
    return this.aesConf.decryptor.decrypt(data, 0, iv.buffer || iv, true)
  }
}

const m3u8Download = new M3u8Download()

function onM3u8KeyResponse(response) {
  console.log('key response: ', response)
  m3u8Download.aesConf.key = response
  m3u8Download.aesConf.decryptor = new AESDecryptor()
  m3u8Download.aesConf.decryptor.constructor()
  m3u8Download.aesConf.decryptor.expandKey(m3u8Download.aesConf.key)
  m3u8Download.downloadTs()
}

function onM3u8Response(response) {
  try {
    console.log('on m3u8 response：')
    const parser = new m3u8Parser.Parser()
    parser.push(response)
    parser.end()

    const manifest = parser.manifest
    const { segments } = manifest
    if (segments) {
      console.log('setAesConf success')
      console.log('ts碎片片段一共有：', segments.length)
      m3u8Download.tsUrlList = segments.map(e => 'https:/' + e.uri)
      m3u8Download.finishList = m3u8Download.tsUrlList.map((e, index) => {
        return {
          title: e,
          status: ''
        }
      })
      console.log(m3u8Download.tsUrlList.slice(0, 2))
      m3u8Download.setAesConf({
        method: segments[0].key.method,
        uri: segments[0].key.uri,
        iv: ''
      })
    }
  } catch (error) {
    console.log(error)
  }
}

function removePadding(buffer) {
  const outputBytes = buffer.byteLength;
  const paddingBytes = outputBytes && (new DataView(buffer)).getUint8(outputBytes - 1);
  if (paddingBytes) {
    return buffer.slice(0, outputBytes - paddingBytes);
  } else {
    return buffer;
  }
}

function AESDecryptor() {
  return {
    constructor() {
      this.rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
      this.subMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      this.invSubMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      this.sBox = new Uint32Array(256);
      this.invSBox = new Uint32Array(256);

      // Changes during runtime
      this.key = new Uint32Array(0);

      this.initTable();
    },

    // Using view.getUint32() also swaps the byte order.
    uint8ArrayToUint32Array_(arrayBuffer) {
      let view = new DataView(arrayBuffer);
      let newArray = new Uint32Array(4);
      for (let i = 0; i < 4; i++) {
        newArray[i] = view.getUint32(i * 4);
      }

      return newArray;
    },

    initTable() {
      let sBox = this.sBox;
      let invSBox = this.invSBox;
      let subMix = this.subMix;
      let subMix0 = subMix[0];
      let subMix1 = subMix[1];
      let subMix2 = subMix[2];
      let subMix3 = subMix[3];
      let invSubMix = this.invSubMix;
      let invSubMix0 = invSubMix[0];
      let invSubMix1 = invSubMix[1];
      let invSubMix2 = invSubMix[2];
      let invSubMix3 = invSubMix[3];

      let d = new Uint32Array(256);
      let x = 0;
      let xi = 0;
      let i = 0;
      for (i = 0; i < 256; i++) {
        if (i < 128) {
          d[i] = i << 1;
        } else {
          d[i] = (i << 1) ^ 0x11b;
        }
      }

      for (i = 0; i < 256; i++) {
        let sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
        sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
        sBox[x] = sx;
        invSBox[sx] = x;

        // Compute multiplication
        let x2 = d[x];
        let x4 = d[x2];
        let x8 = d[x4];

        // Compute sub/invSub bytes, mix columns tables
        let t = (d[sx] * 0x101) ^ (sx * 0x1010100);
        subMix0[x] = (t << 24) | (t >>> 8);
        subMix1[x] = (t << 16) | (t >>> 16);
        subMix2[x] = (t << 8) | (t >>> 24);
        subMix3[x] = t;

        // Compute inv sub bytes, inv mix columns tables
        t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
        invSubMix0[sx] = (t << 24) | (t >>> 8);
        invSubMix1[sx] = (t << 16) | (t >>> 16);
        invSubMix2[sx] = (t << 8) | (t >>> 24);
        invSubMix3[sx] = t;

        // Compute next counter
        if (!x) {
          x = xi = 1;
        } else {
          x = x2 ^ d[d[d[x8 ^ x2]]];
          xi ^= d[d[xi]];
        }
      }
    },

    expandKey(keyBuffer) {
      // convert keyBuffer to Uint32Array
      let key = this.uint8ArrayToUint32Array_(keyBuffer);
      let sameKey = true;
      let offset = 0;

      while (offset < key.length && sameKey) {
        sameKey = (key[offset] === this.key[offset]);
        offset++;
      }

      if (sameKey) {
        return;
      }

      this.key = key;
      let keySize = this.keySize = key.length;

      if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
        throw new Error('Invalid aes key size=' + keySize);
      }

      let ksRows = this.ksRows = (keySize + 6 + 1) * 4;
      let ksRow;
      let invKsRow;

      let keySchedule = this.keySchedule = new Uint32Array(ksRows);
      let invKeySchedule = this.invKeySchedule = new Uint32Array(ksRows);
      let sbox = this.sBox;
      let rcon = this.rcon;

      let invSubMix = this.invSubMix;
      let invSubMix0 = invSubMix[0];
      let invSubMix1 = invSubMix[1];
      let invSubMix2 = invSubMix[2];
      let invSubMix3 = invSubMix[3];

      let prev;
      let t;

      for (ksRow = 0; ksRow < ksRows; ksRow++) {
        if (ksRow < keySize) {
          prev = keySchedule[ksRow] = key[ksRow];
          continue;
        }
        t = prev;

        if (ksRow % keySize === 0) {
          // Rot word
          t = (t << 8) | (t >>> 24);

          // Sub word
          t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];

          // Mix Rcon
          t ^= rcon[(ksRow / keySize) | 0] << 24;
        } else if (keySize > 6 && ksRow % keySize === 4) {
          // Sub word
          t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];
        }

        keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
      }

      for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
        ksRow = ksRows - invKsRow;
        if (invKsRow & 3) {
          t = keySchedule[ksRow];
        } else {
          t = keySchedule[ksRow - 4];
        }

        if (invKsRow < 4 || ksRow <= 4) {
          invKeySchedule[invKsRow] = t;
        } else {
          invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[(t >>> 16) & 0xff]] ^ invSubMix2[sbox[(t >>> 8) & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
        }

        invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
      }
    },

    // Adding this as a method greatly improves performance.
    networkToHostOrderSwap(word) {
      return (word << 24) | ((word & 0xff00) << 8) | ((word & 0xff0000) >> 8) | (word >>> 24);
    },

    decrypt(inputArrayBuffer, offset, aesIV, removePKCS7Padding) {
      let nRounds = this.keySize + 6;
      let invKeySchedule = this.invKeySchedule;
      let invSBOX = this.invSBox;

      let invSubMix = this.invSubMix;
      let invSubMix0 = invSubMix[0];
      let invSubMix1 = invSubMix[1];
      let invSubMix2 = invSubMix[2];
      let invSubMix3 = invSubMix[3];

      let initVector = this.uint8ArrayToUint32Array_(aesIV);
      let initVector0 = initVector[0];
      let initVector1 = initVector[1];
      let initVector2 = initVector[2];
      let initVector3 = initVector[3];

      let inputInt32 = new Int32Array(inputArrayBuffer);
      let outputInt32 = new Int32Array(inputInt32.length);

      let t0, t1, t2, t3;
      let s0, s1, s2, s3;
      let inputWords0, inputWords1, inputWords2, inputWords3;

      let ksRow, i;
      let swapWord = this.networkToHostOrderSwap;

      while (offset < inputInt32.length) {
        inputWords0 = swapWord(inputInt32[offset]);
        inputWords1 = swapWord(inputInt32[offset + 1]);
        inputWords2 = swapWord(inputInt32[offset + 2]);
        inputWords3 = swapWord(inputInt32[offset + 3]);

        s0 = inputWords0 ^ invKeySchedule[0];
        s1 = inputWords3 ^ invKeySchedule[1];
        s2 = inputWords2 ^ invKeySchedule[2];
        s3 = inputWords1 ^ invKeySchedule[3];

        ksRow = 4;

        // Iterate through the rounds of decryption
        for (i = 1; i < nRounds; i++) {
          t0 = invSubMix0[s0 >>> 24] ^ invSubMix1[(s1 >> 16) & 0xff] ^ invSubMix2[(s2 >> 8) & 0xff] ^ invSubMix3[s3 & 0xff] ^ invKeySchedule[ksRow];
          t1 = invSubMix0[s1 >>> 24] ^ invSubMix1[(s2 >> 16) & 0xff] ^ invSubMix2[(s3 >> 8) & 0xff] ^ invSubMix3[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
          t2 = invSubMix0[s2 >>> 24] ^ invSubMix1[(s3 >> 16) & 0xff] ^ invSubMix2[(s0 >> 8) & 0xff] ^ invSubMix3[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
          t3 = invSubMix0[s3 >>> 24] ^ invSubMix1[(s0 >> 16) & 0xff] ^ invSubMix2[(s1 >> 8) & 0xff] ^ invSubMix3[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
          // Update state
          s0 = t0;
          s1 = t1;
          s2 = t2;
          s3 = t3;

          ksRow = ksRow + 4;
        }

        // Shift rows, sub bytes, add round key
        t0 = ((invSBOX[s0 >>> 24] << 24) ^ (invSBOX[(s1 >> 16) & 0xff] << 16) ^ (invSBOX[(s2 >> 8) & 0xff] << 8) ^ invSBOX[s3 & 0xff]) ^ invKeySchedule[ksRow];
        t1 = ((invSBOX[s1 >>> 24] << 24) ^ (invSBOX[(s2 >> 16) & 0xff] << 16) ^ (invSBOX[(s3 >> 8) & 0xff] << 8) ^ invSBOX[s0 & 0xff]) ^ invKeySchedule[ksRow + 1];
        t2 = ((invSBOX[s2 >>> 24] << 24) ^ (invSBOX[(s3 >> 16) & 0xff] << 16) ^ (invSBOX[(s0 >> 8) & 0xff] << 8) ^ invSBOX[s1 & 0xff]) ^ invKeySchedule[ksRow + 2];
        t3 = ((invSBOX[s3 >>> 24] << 24) ^ (invSBOX[(s0 >> 16) & 0xff] << 16) ^ (invSBOX[(s1 >> 8) & 0xff] << 8) ^ invSBOX[s2 & 0xff]) ^ invKeySchedule[ksRow + 3];
        ksRow = ksRow + 3;

        // Write
        outputInt32[offset] = swapWord(t0 ^ initVector0);
        outputInt32[offset + 1] = swapWord(t3 ^ initVector1);
        outputInt32[offset + 2] = swapWord(t2 ^ initVector2);
        outputInt32[offset + 3] = swapWord(t1 ^ initVector3);

        // reset initVector to last 4 unsigned int
        initVector0 = inputWords0;
        initVector1 = inputWords1;
        initVector2 = inputWords2;
        initVector3 = inputWords3;

        offset = offset + 4;
      }

      return removePKCS7Padding ? removePadding(outputInt32.buffer) : outputInt32.buffer;
    },

    destroy() {
      this.key = undefined;
      this.keySize = undefined;
      this.ksRows = undefined;

      this.sBox = undefined;
      this.invSBox = undefined;
      this.subMix = undefined;
      this.invSubMix = undefined;
      this.keySchedule = undefined;
      this.invKeySchedule = undefined;

      this.rcon = undefined;
    },
  }
}