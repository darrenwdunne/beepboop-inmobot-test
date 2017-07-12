require('dotenv').config() // uid/pw go in .env file not checked in

var getProducts = function () {
  var comps = JSON.parse(process.env.PRODUCT_OWNERS)
  // for (var i=0; i<comps.length; i++) {
  //   var comp = comps[i]
  //   console.log(comp)
  // }
  return comps
}

function getProductOwner (compName) {
  var comps = getProducts()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].owner
    }
  }
}

function getProductOwnerJiraId (compName) {
  var comps = getProducts()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].ownerJiraId
    }
  }
}

function getProductLabel (compName) {
  var comps = getProducts()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].label
    }
  }
}

function getProductNames () {
  var comps = getProducts()
  var names = []
  for (var i = 0; i < comps.length; i++) {
    names.push(comps[i].name)
  }
  return names
}

// console.log(getProductOwner('Proximus'))
// console.log(getProductOwner('R + A'))
// console.log(getProductNames())

function getProductButtons () {
  var compNames = getProductNames()
  var compButtons = []
  for (let i in compNames) {
    var cmp = { name: 'answer', text: compNames[i], type: 'button', value: compNames[i] }
    compButtons.push(cmp)
  }
  return compButtons
}

exports.getProductButtons = getProductButtons
exports.getProductOwner = getProductOwner
exports.getProductOwnerJiraId = getProductOwnerJiraId
exports.getProductLabel = getProductLabel
