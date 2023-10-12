// ==UserScript==
// @name         阿里巴巴插件2.0
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  汇总询问订单和对应的订单详情，导出excel表
// @author       You
// @match        https://message.alibaba.com/message/*
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

/**
 * JS转成ex文件，前端进行导出
 * @param {*} JSONData  JSON数据
 * @param {*} FileName   你希望导出文件的文件名
 * @param {*} title     你希望的字段名也就是表头，一般情况下直接，没有特殊需求的话直接填入false就好
 * @param {*} filter   你希望过滤的行数   如果没有也直接填入false就好
 */
const JSONToExcelConvertor = (JSONData, FileName, title, filter) => {
  if (!JSONData)
    return;
  //转化json为object
  var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;
  var excel = "<table>";
  //设置表头  
  var row = "<tr>";
  if (title) {
    //使用标题项
    for (var i in title) {
      row += "<th align='center'>" + title[i] + '</th>';
    }
  }
  else {
    //不使用标题项
    for (var i in arrData[0]) {
      row += "<th align='center'>" + i + '</th>';
    }
  }
  excel += row + "</tr>";
  //设置数据  
  for (var i = 0; i < arrData.length; i++) {
    var row = "<tr>";
    for (var index in arrData[i]) {
      //判断是否有过滤行
      if (filter) {
        if (filter.indexOf(index) == -1) {
          var value = arrData[i][index] == null ? "" : arrData[i][index];
          row += '<td>' + value + '</td>';
        }
      }
      else {
        var value = arrData[i][index] == null ? "" : arrData[i][index];
        if (value && value.split && value.split('\n').length > 1) {
          const _value = value.split('\n').map(e => `<div>${e}</div>`).join('')
          row += "<td align='center'>" + _value + "</td>";
        } else {
          row += "<td align='center'>" + value + "</td>";
        }
      }
    }
    excel += row + "</tr>";
  }
  excel += "</table>";

  //下面是构建文件的代码
  var excelFile = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>";
  excelFile += '<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">';
  excelFile += '<meta http-equiv="content-type" content="application/vnd.ms-excel';
  excelFile += '; charset=UTF-8">';
  excelFile += "<head>";
  excelFile += "<!--[if gte mso 9]>";
  excelFile += "<xml>";
  excelFile += "<x:ExcelWorkbook>";
  excelFile += "<x:ExcelWorksheets>";
  excelFile += "<x:ExcelWorksheet>";
  excelFile += "<x:Name>";
  excelFile += "{worksheet}";
  excelFile += "</x:Name>";
  excelFile += "<x:WorksheetOptions>";
  excelFile += "<x:DisplayGridlines/>";
  excelFile += "</x:WorksheetOptions>";
  excelFile += "</x:ExcelWorksheet>";
  excelFile += "</x:ExcelWorksheets>";
  excelFile += "</x:ExcelWorkbook>";
  excelFile += "</xml>";
  excelFile += "<![endif]-->";
  excelFile += "</head>";
  excelFile += "<body>";
  excelFile += excel;
  excelFile += "</body>";
  excelFile += "</html>";
  var uri = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(excelFile);
  //创建一个a标签
  var link = document.createElement("a");
  //给a标签一个路径
  link.href = uri;
  //为了防止这个a标签显示在视图上，需要先把他隐藏
  link.style = "visibility:hidden";
  //为文件添加后缀名，告诉他这是一个ex文件
  link.download = FileName + ".xls";
  //把a标签添加到body上
  document.body.appendChild(link);
  //触发a标签，等于访问这个文件地址，实现文件下载
  link.click();
  //文件下载完毕后删除a标签，以免对DOM产生冗余
  document.body.removeChild(link);
}

function waitElement(selector, times, interval, flag = true) {
  var _times = times || 100,     // 默认50次
    _interval = interval || 100, // 默认每次间隔100毫秒
    _selector = selector, //选择器
    _iIntervalID,
    _flag = flag; //定时器id

  return new Promise(function (resolve, reject) {
    _iIntervalID = setInterval(function () {
      if (!_times) { //是0就退出
        clearInterval(_iIntervalID);
        reject();
      }
      _times <= 0 || _times--; //如果是正数就 --
      var _self = document.querySelector(_selector); //再次选择
      if ((_flag && _self) || (!_flag && !_self)) { //判断是否取到
        clearInterval(_iIntervalID);
        resolve(_self);
      }
    }, _interval);
  });
}

const _GLOBAL = {
  list: [],
}

let maxTabsCount = parseInt(GM_getValue("maxTabsCount")) || 10;
let tabsCount = 0;

function canCreateTab() {
  return new Promise((resolve) => {
    let callBack = () => {
      if (tabsCount < maxTabsCount) {
        tabsCount++
        resolve(true)
      } else {
        setTimeout(() => {
          callBack()
        }, 500)
      }
    }
    callBack()
  })
}


function delay(timeout = 1000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

function createKey(roundKey, kk) {
  const key = 'key_' + roundKey + '_' + kk
  return key
}

async function clearGMValues() {
  const keys = GM_listValues()
  for (let key in keys) {
    GM_deleteValue(key)
  }
}

function getPage() {
  // const url = window.location.href
  // return Number(url.split('|')[1] || 1)
  const current = document.querySelector('.ui2-pagination-pages .current')
  if (!current) {
    return 1
  }
  return Number(current.innerText)
}

function getPagesCount() {
  const next = document.querySelector('.ui2-pagination-pages .next')
  if (next) {
    return Number(next.previousElementSibling.innerText)
  }
  const list = [...document.querySelectorAll('.ui2-pagination-pages a[data-page]')]
  return Number(list[list.length - 1].getAttribute('data-page'))
}

function appendButton() {
  const button = document.createElement('button')
  button.style.display = 'block'
  button.textContent = '采集当前页'

  button.addEventListener('click', async () => {
    const roundKey = Math.random().toString(36).slice(-8)
    await GM_setValue("roundKey", roundKey)
    button.innerText = '采集中'
    const data = await getList(roundKey)
    console.log("single total data: ", data)
    button.innerText = '采集当前页'
    JSONToExcelConvertor(data, '文件名', false, false);
  })

  return button
}

function appendInput() {
  const inputWrapper = document.createElement('div')
  const maxCountInput = document.createElement('input')
  maxCountInput.value = maxTabsCount
  maxCountInput.style.width = '36px'
  inputWrapper.innerText = '同时打开Tab数：'
  inputWrapper.appendChild(maxCountInput)

  maxCountInput.addEventListener('change', (e) => {
    console.log(e.target.value)
    const newCount = parseInt(e.target.value) || 10
    maxTabsCount = newCount
    GM_setValue("maxTabsCount", newCount)
  })
  return inputWrapper
}

function appendBatchButton() {
  const button = document.createElement('button')
  button.style.display = 'block'


  button.textContent = '采集所有页'
  button.addEventListener('click', async () => {
    document.querySelector('.ui2-pagination-pages a[data-page="1"]').click()
    await delay(100)
    await waitElement('.ui2-pagination-pages .current')
    const roundKey = Math.random().toString(36).slice(-8)
    await GM_setValue("roundKey", roundKey)
    button.innerText = '采集中'
    const pagesData = {}
    let node = document.querySelector('.next')
    let pageCount = 0;
    while (node) {
      const page = getPage()
      console.log("page: ", page)
      const data = await getList(roundKey)
      // const data = [page]
      console.log("page data: ", data)
      pagesData[page] = data
      console.log("pages all: ", pagesData)
      node = document.querySelector('.next')
      if (node) {
        await node.click()
        await delay(1000)
      }

      // pageCount++;
      // if (pageCount >= 5) {
      //   node = null
      // }
    }
    console.log(pagesData)
    const total = []
    Object.keys(pagesData).sort((a, b) => a - b).forEach(page => {
      const list = (pagesData[page] || []).map(e => {
        return {
          ...e,
          "页码": page
        }
      })
      total.push(...list)
    })

    console.log("all total: ", total)

    JSONToExcelConvertor(total, '文件名', false, false);

    button.innerText = '采集所有页'
  })

  return button
}

function initListPage() {
  const wrapper = document.createElement('div')
  const singleButton = appendButton()
  const batchButton = appendBatchButton()
  const input = appendInput()
  wrapper.style.cssText = `
    position: fixed;
    top: 50%;
    right: 20px;
    z-index: 2010;
    display: flex;
    flex-direction: column;
    padding: 10px 20px;
    border-radius: 4px;
    background-color: #f2f2f2;
    gap: 10px;
  `
  wrapper.appendChild(singleButton)
  wrapper.appendChild(batchButton)
  wrapper.appendChild(input)
  document.body.appendChild(wrapper)
  console.log('button append success!!')
}

const queueDetail = (detailId, roundKey, handle) => {

  return new Promise((resolve) => {
    let timer;

    const key = createKey(roundKey, detailId)
    const listenerId = GM_addValueChangeListener(key, (name, oldValue, newValue) => {
      if (!newValue || !Object.keys(newValue).length) {
        return
      }
      clearTimeout(timer)
      resolve(newValue)
      GM_deleteValue(key)
      console.log("notify to close key: ", key + '_close')
      GM_setValue(key + '_close', Date.now())
      tabsCount = Math.max(0, tabsCount - 1);
      setTimeout(() => {
        GM_removeValueChangeListener(listenerId)
      })
    })
    canCreateTab().then(() => {
      // tabsCount = tabsCount + 1
      handle()
      timer = setTimeout(() => {
        console.log("resolve by timeout")
        tabsCount = Math.max(0, tabsCount - 1);
        resolve({
          country: "获取失败",
          sitphone: "获取失败",
          phone: "获取失败",
          email: "获取失败",
          home: "获取失败",
          registerTime: "获取失败",
        })
      }, 20000)
    })
  })

}

async function getList(roundKey) {
  return new Promise((resolve) => {
    const list = [...document.querySelectorAll(".aui2-grid-wraper")]
    const data = []
    const len = list.length
    // const len = 10
    let count = 0
    for (let i = 0; i < len; i++) {
      const item = list[i]
      const reg = (/([0-9]{4}-[0-9]{1,2}-[0-9]{1,2})|([0-9]{2}:[0-9]{2})/gi)
      const time = (item.querySelector('.spec-inquiry-id').nextElementSibling.innerText || '').match(reg)
      const orderNo = item.querySelector('.spec-inquiry-id').innerText.replace('询价单号：', '')
      const updateTime = time[0] || ''
      const createTime = time[1] || ''
      const itemData = {
        // orderNo: item.querySelector('.spec-inquiry-id').innerText.replace('询价单号：', ''),
        订单号: orderNo,
        更新时间: updateTime,
        创建时间: createTime,
        // time: item.querySelector('.spec-inquiry-id').nextElementSibling.innerText,
        来源: item.querySelector('.buyer-product-name-content').innerText,
        顾客名称: item.querySelector('.aui2-grid-name.u-text-center').innerText,
        负责人: item.querySelector('.aui-grid-inner-text.aui-grid-owner-name').innerText,
      }
      const viewDetailBtn = item.querySelector('.actions-view-detail')
      // const detailValue = await queueDetail(orderNo.trim(), roundKey, () => {
      queueDetail(orderNo.trim(), roundKey, () => {
        viewDetailBtn.click()
      }).then(detailValue => {
        // console.log("detailValue: ", detailValue)
        itemData['国家'] = detailValue.country
        itemData['座机'] = detailValue.sitphone
        itemData['手机'] = detailValue.phone
        itemData['公司邮箱'] = detailValue.email
        itemData['公司官网'] = detailValue.home
        itemData['公司注册时间'] = detailValue.registerTime
        // itemData["详情"] = `
        //   国家：${detailValue.country} \n
        //   公司官网：${detailValue.home} \n
        //   公司邮箱：${detailValue.email} \n
        //   注册时间：${detailValue.registerTime} \n
        //   手机：${detailValue.phone} \n
        //   座机：${detailValue.sitphone} \n
        // `
      }).finally(() => {
        count++
        if (count >= len) {
          console.log('当前页解析结束！！！oh')
          resolve(data)
        }
      })
      data.push(itemData)
    }
  })
}

function getUrlSearch(name) {
  if (!name) return null;
  var after = window.location.search;
  after = after.substr(1) || window.location.hash.split('?')[1];
  if (!after) return null;
  if (after.indexOf(name) === -1) return null;

  var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
  var r = decodeURI(after).match(reg);
  if (!r) return null;
  return r[2];
}

async function watchTargetNode(selector, config = { childList: true }, timeout = 3000) {
  return new Promise(async (resolve) => {
    let timer = setTimeout(() => {
      resolve()
    }, timeout)
    await waitElement(selector)
    const node = document.querySelector(selector)
    const callback = function (mutationsList, observer) {
      // console.log(mutationsList)
      console.log(`watch target ${node} change: `, mutationsList)
      for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
          console.log("A child node has been added or removed.");
          console.log(node)
          clearInterval(timer)
          resolve()
        }
      }
    }
    const observer = new MutationObserver(callback)
    observer.observe(node, config)
  })
}

async function extractDetailData() {
  const imInquiryId = getUrlSearch("imInquiryId")
  if (!imInquiryId) {
    console.log("[Not Found imInquiryId exit.]")
    return
  }
  const tabItem = document.querySelector('li[data-key=crm]')
  if (!tabItem) {
    console.log("[crm not found]")
    return
  }
  await delay(1000)

  if (!document.querySelector('.name-text')?.innerText) {
    await watchTargetNode('.name-text', {
      childList: true
    })
  }
  const roundKey = await GM_getValue("roundKey")
  console.log("round key: ", roundKey)
  await delay(100)
  tabItem.click()

  await waitElement('.alicrm-customer-detail-card')
  const cardWrapper = document.querySelector('.alicrm-customer-detail-card')
  const data = {
    name: cardWrapper.querySelector('.name-text')?.innerText || '-',
    levelIcon: (cardWrapper.querySelector('.icon-content img'))?.getAttribute?.('src') || '-',
    country: cardWrapper.querySelector('.country-flag-label')?.innerText || '-',
    registerTime: "",
    home: "",
    email: "",
    phone: "",
    sitphone: "",
  }
  const keysMap = {
    "注册时间": "registerTime",
    "公司官网": "home",
    "邮箱": "email",
    "手机": "phone",
    "座机": "sitphone",
  }
  const formItems = [...cardWrapper.querySelectorAll('.base-information-form-item')].map(item => {
    return {
      label: item.querySelector('.base-information-form-item-label')?.innerText,
      content: item.querySelector('.base-information-form-item-content')?.innerText,
      html: item.querySelector('.base-information-form-item-content')?.innerHTML,
    }
  })

  formItems.forEach(item => {
    data[keysMap[item.label]] = item.content
  })

  const sendKey = createKey(roundKey, imInquiryId)
  await GM_setValue(sendKey, data)
  const closeKey = createKey(roundKey, imInquiryId + '_close')
  console.log("wait close key: ", closeKey)
  GM_addValueChangeListener(closeKey, () => {
    window.close()
  })
}

async function extractDetailDataV2() {
  console.log('extractDetailDataV2 start')
  const imInquiryId = getUrlSearch("imInquiryId")
  if (!imInquiryId) {
    console.log("[Not Found imInquiryId exit.]")
    return
  }

  const roundKey = await GM_getValue("roundKey")
  const detailData = await getDetailForm()

  const data = {
    name: detailData.username || '-',
    country: detailData.country || '-',
    registerTime: detailData.registerDate || '-',
    home: detailData.companyWebSite,
    email: detailData.email,
    phone: detailData.phoneNumber,
    sitphone: detailData.mobileNumber,
  }
  const keysMap = {
    "注册时间": "registerTime",
    "公司官网": "companyWebSite",
    "邮箱": "email",
    "手机": "phone",
    "座机": "sitphone",
  }

  Object.keys(keysMap).forEach(key => {
    data[key] = data[keysMap[key]]
  })

  console.log('extractDetailDataV2 data: ', data)


  const sendKey = createKey(roundKey, imInquiryId)
  await GM_setValue(sendKey, data)
  const closeKey = createKey(roundKey, imInquiryId + '_close')
  console.log("wait close key: ", closeKey)
  GM_addValueChangeListener(closeKey, () => {
    window.close()
  })
}

let currentDetail
let times = 0

function getDetailForm(window) {
  let start = Date.now()
  return new Promise((resolve) => {
    const loopWindow = (window) => {
      if (currentDetail) {
        resolve(currentDetail)
      }
      // if (times >= 100000) {
      //   return
      // }
      if (Date.now() - start >= 10000) {
        resolve({})
        return
      }

      // times++
      const keys = Object.keys(window || {})
      console.log(keys.length)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        if (key.indexOf('jsonp') === -1) {
          continue
        }
  
        let temp = window[key]
        window[key] = (value) => {
          const c = value?.data?.data ?? null
          if (c && c.buyerInfo && c.buyerInfo.buyerContactInfo) {
            // console.log('json value: ', value)
            const { buyerInfo } = c
            const { buyerContactInfo } = buyerInfo
            const { companyName, registerDate, companyWebSite } = buyerInfo
            const { email, mobileNumber, phoneNumber } = buyerContactInfo
            const detailData = {
              country: buyerInfo.country,
              username: buyerInfo.firstName + ' ' + buyerInfo.lastName,
              companyName,
              registerDate: registerDate ? new Date(parseInt(registerDate + '000')).toLocaleDateString() : '',
              email,
              mobileNumber,
              phoneNumber,
              companyWebSite,
            }
            currentDetail = detailData
            times = 100000000
            resolve(currentDetail)
            // console.log("detailData: ", detailData)
          }
          temp(value)
        }
      }

      setTimeout(() => {
        loopWindow(window)
      }, 0)
    }
    
    loopWindow(window)
  })
}


function main(window) {
  setTimeout(async () => {
    if (window.location.href.indexOf('message/default.htm') !== -1) {
      await waitElement('.ui2-pagination-pages .current')
      const currentPage = getPage()
      const pagesCount = getPagesCount()
      console.log(`当前页为: ${currentPage}, 所有页数为：${pagesCount}`)
      initListPage()
    }
  }, 1000)

  if (window.location.href.indexOf('message/maDetail.htm') !== -1) {
    getDetailForm(window)
    extractDetailDataV2()
  }
  // setTimeout(() => {
  //   if (window.location.href.indexOf('message/maDetail.htm') !== -1) {
  //     // extractDetailData()
  //   }
  // }, 500)
}

(function (window) {
  'use strict';
  main(window)
})(unsafeWindow);