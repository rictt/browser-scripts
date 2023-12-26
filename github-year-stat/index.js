// ==UserScript==
// @name         请求重写
// @namespace    http://tampermonkey.net/
// @description  请求重写
// @version      0.1
// @author       You
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
  console.log(window.unsafeWindow)

  const originFetch = fetch;
  console.log(originFetch)
  window.unsafeWindow.fetch = (url, options) => {
    return originFetch(url, options).then(async (response) => {
      return response;

      if (url === 'http://localhost:3002/api/query') {
        const responseClone = response.clone();
        let res = await responseClone.json();
        res.data.push('油猴脚本修改数据')
        const responseNew = new Response(JSON.stringify(res), response);
        return responseNew;
      } else {
        return response;

      }
    });
  };

  const originOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (_, url) {
    // https://juejin.cn/post/7135590843544502308
    this.addEventListener("readystatechange", function() {
      if (this.readyState === 4) {
        // console.log(JSON.parse(this.responseText))
        const contentType = this.getResponseHeader("Content-Type")
        const type = typeof this.response
        console.log(contentType, type)
      }
    })
    originOpen.apply(this, arguments);
  };

})();