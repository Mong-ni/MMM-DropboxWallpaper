require('isomorphic-fetch')
const Dropbox = require('dropbox').Dropbox
const path = require('path')
const fs = require('fs')
const moment = require('moment')
const request = require('request')
const ExifImage = require('exif').ExifImage
const Jimp = require("jimp");


const STORE = path.join(__dirname, 'cache')


var mySort = {
  time90: function(a, b) {
    var atm = moment(a.time)
    var btm = moment(b.time)

    if (atm.isBefore(btm)) return -1
    if (atm.isAfter(btm)) return 1
    return 0
  },

  time09: function(a, b) {
    var atm = moment(a.time)
    var btm = moment(b.time)

    if (atm.isBefore(btm)) return 1
    if (atm.isAfter(btm)) return -1
    return 0
  },

  nameZA: function(a, b) {
    if (a.name < b.name) return 1
    if (a.name > b.name) return -1
    return 0
  },

  nameAZ: function(a, b) {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  },

  random: function(a, b) {
    return 0.5 - Math.random()
  }
}




var NodeHelper = require('node_helper')
module.exports = NodeHelper.create({
  start: function() {
    this.config = {}
    this.images = []
    this.index = 0
  },

  socketNotificationReceived: function (noti, payload) {
    switch(noti) {
      case 'INIT_CONFIG':
        this.initializeAfterLoading(payload)
        break;
    }
  },

  initializeAfterLoading: function(config) {
    this.config = config
    if (!this.config.verbose) {

    }
    this.dbx = new Dropbox({accessToken: this.config.dropboxAccessToken})
    console.log('[DBXWLP] Configuration is initialized.')
    this.scan(this.config.scanDirectory)
  },

  scan: function(directory, continueArg={}) {
    console.log("[DBXWLP] Starting photo scanning.")
    var extCount = this.config.search.length;
    var tempItems = []
    var maxResult = 10
    var totalCount = 0
    var endFlag = false
    var fileSearch = (directory, ext, start) => {
      this.dbx.filesSearch({
        "path": directory,
        "query": ext,
        "start": start,
        "max_results": maxResult,
        "mode": "filename"
      }).then((result)=>{
        var count = result.matches.length
        totalCount += count
        for (var j in result.matches) {
          var item = result.matches[j]
          count--
          console.log("[DBXWLP] Scanning.", totalCount, count)
          if (item.metadata['.tag'] !== 'file') {
            totalCount--
            continue
          }
          this.dbx.filesGetMetadata({
            "path":item.metadata.path_lower,
            "include_media_info":true,
          }).then((it)=>{
            var dimensions = {"width":null, "height":null}
            var location = {"latitude":null, "longitude":null}
            var time = new moment(it.server_modified).format("x")
            if (typeof it.media_info !== "undefined") {
              dimensions = it.media_info.metadata.dimensions
              location = it.media_info.metadata.location
              time = new moment(it.media_info.metadata.time_taken).format("x")
            }
            var found = {
              "name": it.name,
              "path": it.path_lower,
              "id": it.id,
              "dimensions": dimensions,
              "location": location,
              "time": time
            }
            tempItems.push(found)
            if (totalCount == tempItems.length && endFlag) {
              this.images = tempItems
              this.scanned()
            }
          }, console.error)
        }
        if (result.more) {
          fileSearch(directory, ext, result.start)
        } else {
          extCount--

          if (extCount <= 0) {
            endFlag = true
          }
        }
      }, console.error)
    }
    for (var i in this.config.search) {
      var ext = this.config.search[i]
      fileSearch(this.config.directory, ext, 0)
    }
  },

  scanned: function() {
    console.log("[DBXWLP] All photos are found.:", this.images.length)
    this.images.sort(mySort[this.config.sort])
    this.work()
  },

  work: function() {
    var timer = null
    if (this.index >= this.images.length) {
      clearTimeout(timer)
      this.index = 0
      console.log("[DBXWLP] Cycle finished")
      this.scan()
    } else {
      var photo = this.images[this.index]
      this.download(photo)
      this.index++
      timer = setTimeout(()=>{
        this.work()
      }, this.config.refreshInterval)
    }
  },

  download: function(photo) {
    photo.orientation = 1
    photo.time = new moment.unix(photo.time / 1000).format(this.config.dateTimeFormat)
    photo.locationText = ""
    var filePath = path.join(STORE, "temp")

    var getGeo = (photo) => {
      if (this.config.tokenLocationIQ && photo.location) {
        if (photo.location.latitude && photo.location.longitude) {
          var geo = this.getGeoReverse(photo.location, (locString)=>{
            photo.locationText = locString
            this.sendSocketNotification("NEW_PHOTO", photo)
          })
        }
      } else {
        this.sendSocketNotification("NEW_PHOTO", photo)
      }
    }

    var readOri = (photo, cb) => {
      try {
        new ExifImage({ image : filePath }, (error, exifData) => {
          if (error) {
            console.log("Error:", error)
            cb(photo)
          }
          photo.orientation
            = (typeof exifData.image.Orientation !== "undefined")
            ? exifData.image.Orientation
            : 1
          cb(photo)
        })
      } catch (error) {
        //console.log('Error: ' + error.message);
        console.log("catchError:", error)
        cb(photo)
      }
    }


    this.dbx.filesDownload({"path":photo.path}).then((data) => {
      fs.writeFileSync(filePath, data.fileBinary, "binary")
      console.log("[DBXWLP]", photo.name, "is downloaded.")
      readOri(photo, getGeo)
    })
  },

  getGeoReverse: function(location, onFinished) {
    var lat = location.latitude
    var lon = location.longitude
    var query = "http://locationiq.org/v1/reverse.php?format=json&key="
      + this.config.tokenLocationIQ
      + "&lat=" + lat
      + "&lon=" + lon



      request(query, { json: true }, (err, res, data) => {
        if (err) {
          console.error(err)
          return null
        }
        var loc = ""
        var part = ""

        var level = [
          'water', 'road', 'hotel', , 'pedestrian', 'stadium', 'university', 'public',
          'manor', 'memorial', 'monument', 'ruins', 'tower', 'beach_resort',
          'garden', 'marina', 'park', 'american_football', 'baseball',
          'golf', 'multi', 'building', 'aquarium', 'artwork', 'attraction',
          'museum', 'theme_park', 'viewpoint', 'zoo', 'castle', 'fort',
          'gallery'
        ]
        for (var l in level) {
          var s = level[l]
          if(typeof data.address[s] !== 'undefined') part = data.address[s]
        }
        loc += ((part) ? (part + ", ") : "")

        part = ""
        var level = [
          'hamlet', 'isolated_dwelling', 'farm', 'allotments',
          'plot', 'city_block', 'neighbourhood', 'quarter',
          'suburb', 'borough', 'village', 'town', 'city'
        ]
        for (var l in level) {
          var s = level[l]
          if(typeof data.address[s] !== 'undefined') part = data.address[s]
        }
        loc += ((part) ? (part + ", ") : "")

        part = ""
        var level = [
          'state', 'region', 'province', 'district', 'county', 'municipality'
        ]
        for (var l in level) {
          var s = level[l]
          if(typeof data.address[s] !== 'undefined') part = data.address[s]
        }
        loc += ((part) ? (part + ", ") : "")

        loc += data.address.country_code.toUpperCase()
        onFinished(loc)
      })
  }
})
