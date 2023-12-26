// ==UserScript==
// @name         Github年度统计
// @namespace    http://tampermonkey.net/
// @description  Github年度统计
// @version      0.1
// @author       You
// @match        https://github.com/*
// @icon         https://github.com/fluidicon.png
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {

  function getTimeList() {
    const list = Array.from(document.querySelectorAll('.TimelineItem'))
    const result = []
    list.forEach(listItem => {
      const parent = listItem.parentElement
      const activityTime = parent?.querySelector('.color-bg-default.pl-2.pr-3')?.innerText
      const activityDesc = listItem.querySelector('.color-fg-default.ws-normal.text-left')?.innerText
      const __list = [...listItem.querySelectorAll('.d-flex.flex-justify-between.py-1'), ...listItem.querySelectorAll('.ml-0.py-1.d-flex')]
      const activityList = __list.map(e => {
        const aList = Array.from(e.querySelectorAll('a.Link'))
        if (aList.length) {
          return {
            repository: aList[0]?.innerText,
            repositoryLink: aList[0]?.href,
            desc: aList[1]?.innerText,
            language: e?.querySelector('.repo-language-color')?.nextElementSibling?.innerText ?? '',
            time: e?.querySelector('time')?.innerText
          }
        }
        return null
      }).filter(e => e)

      result.push({
        activityTime,
        activityList,
        activityDesc
      })
    })

    return result
  }

  function stat() {
    // 计算创建了多少个仓库
    const years = {
      2023: {},
      2022: {},
      2021: {}
    }
    const list = getTimeList()
    list.forEach(listItem => {
      const { activityList, activityDesc, activityTime } = listItem
      const [month, year] = activityTime.split(' ')
      const data = years[year]
      if (!data.repositoryCount) {
        data.repositoryCount = 0
      }
      if (!data.languageMap) {
        data.languageMap = {}
      }
      if (!data.commitRepositoryMap) {
        data.commitRepositoryMap = {}
      }
      if (activityList?.length) {
        activityList.forEach(activity => {
          const { language, desc, repository } = activity
          if (language) {
            // 视为创建仓库
            data.repositoryCount++
            if (!data.languageMap[language]) {
              data.languageMap[language] = 0
            }
            data.languageMap[language]++
          } else if (desc?.indexOf('commits') !== -1 && repository) {
            // 视为提交commit
            const [count, _] = desc.split(' ')
            if (!data.commitRepositoryMap[repository]) {
              data.commitRepositoryMap[repository] = 0
            }
            data.commitRepositoryMap[repository] += parseInt(count) || 1
          }
        })
      }
    })

    console.log(years)
    return years
  }

  function sortMap(obj) {
    return Object.entries(obj || {}).map(e => {
      return {
        name: e[0],
        count: e[1]
      }
    }).sort((a, b) => b.count - a.count)
  }

  function output() {
    const log = (str) => {
      console.log('%c' + str, "font-size:20px; background:#FFF; color:#581845;padding:4px 10px; border: 2px solid #581845;border-radius:10px;")
    }
    const yearsStat = stat()
    const thisYearStat = yearsStat[new Date().getFullYear()]
    const { repositoryCount, languageMap, commitRepositoryMap } = thisYearStat
    const sortLanguage = sortMap(languageMap)
    const sortCommit = sortMap(commitRepositoryMap)

    console.group("Github年终统计")
    if (!repositoryCount) {
      log(`过去一年您创建了${repositoryCount}个仓库，相信您还在项目探索阶段，请继续加油`)
    } else {
      log(`过去一年您创建了${repositoryCount}个仓库，平均水平不清楚，但您肯定超过了99%的github开发者～`)
    }

    if (sortLanguage?.length === 1) {
      log(`这一年中您最喜欢的语言多是${sortLanguage[0].name}，该语言前景一定不错～`)
    } else {
      if (sortLanguage?.length >= 2) {
        log(`这一年中您偏爱${sortLanguage[0].name}、${sortLanguage[1].name}进行开发，相信开发体验一定不错`)
      }
    }

    const topThree = sortCommit.slice(0, 3).map(e => '「' + e.name + '」' + '提交了：' + e.count + '次代码').join('、')
    log(`您在${topThree}，辛苦了，来年财运滚滚赚笔大的～`)

    console.groupEnd()
  }

  function fetchPagination() {
    const button = document.querySelector('.ajax-pagination-btn')
    if (!button) {
      return console.error('button not exist')
    }
    button.click()
  }

  function injectButton() {
    const button = document.createElement('button')
    button.style.cssText = `position: fixed; top: 45%; right: 4px; z-index: 2023`;
    button.innerText = '2023报告'


    let timer = null
    button.addEventListener('click', () => {
      const check = () => {
        const list = Array.from(document.querySelectorAll('.color-bg-default.pl-2.pr-3 > span.color-fg-muted'))
        const flag = list.some(e => e.innerText?.indexOf('2022') !== -1)
        if (flag) {
          clearTimeout(timer)
          output()
          return
        }
        fetchPagination()
        timer = setTimeout(() => {
          check()
        }, 1000)
        return false
      }

      const thisYearBtn = document.querySelector('#year-link-2023')
      if (thisYearBtn) {
        thisYearBtn.click()
        setTimeout(() => {
          check()
        }, 500)
      } else {
        alert('请点击2023年进行统计')
      }
    })

    document.body.appendChild(button)
  }

  injectButton()

})();