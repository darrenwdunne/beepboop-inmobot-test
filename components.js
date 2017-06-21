require('dotenv').config() // uid/pw go in .env file not checked in

var getComponents = function () {
  var comps = JSON.parse(process.env.COMPONENT_OWNERS)
  // for (var i=0; i<comps.length; i++) {
  //   var comp = comps[i]
  //   console.log(comp)
  // }
  return comps
}

function getComponentOwner (compName) {
  var comps = getComponents()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].owner
    }
  }
}

function getComponentOwnerId (compName) {
  var comps = getComponents()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].ownerid
    }
  }
}

function getComponentLabel (compName) {
  var comps = getComponents()
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].name === compName) {
      return comps[i].label
    }
  }
}

function getComponentNames () {
  var comps = getComponents()
  var names = []
  for (var i = 0; i < comps.length; i++) {
    names.push(comps[i].name)
  }
  return names
}

console.log(getComponentOwner('Proximus'))
console.log(getComponentOwner('R + A'))
console.log(getComponentNames())

function getComponentButtons () {
  var compNames = getComponentNames()
  var compButtons = []
  for (let i in compNames) {
    var cmp = { name: 'answer', text: compNames[i], type: 'button', value: compNames[i] }
    compButtons.push(cmp)
  }
  return compButtons
}

exports.getComponentButtons = getComponentButtons
exports.getComponentOwner = getComponentOwner
exports.getComponentOwnerId = getComponentOwnerId
exports.getComponentLabel = getComponentLabel
