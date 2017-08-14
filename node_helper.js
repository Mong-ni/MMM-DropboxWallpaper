var Dropbox = require('dropbox')
var path = require('path')
var fs = require('fs')
var moment = require('moment')
//var piexif = require("piexifjs");

const STORE = path.join(__dirname, 'cache')

var mySort = {
  byName: function(a, b) {
    if (a.name < b.name) return 1
    if (a.name > b.name) return -1
    return 0
  },

  byNameReverse: function(a, b) {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  },

  byTime: function(a, b) {
    var atm = moment(a.time)
    var btm = moment(b.time)

    if (atm.isBefore(btm)) return -1
    if (atm.isAfter(btm)) return 1
    return 0
  },

  byTimeReverse: function(a, b) {
    var atm = moment(a.time)
    var btm = moment(b.time)

    if (atm.isBefore(btm)) return 1
    if (atm.isAfter(btm)) return -1
    return 0
  },

  byRandom: function(a, b) {
    return 0.5 - Math.random()
  }
}

var dbx
var NodeHelper = require('node_helper')
module.exports = NodeHelper.create({
  start: function() {
    this.firstScan = 1
    this.config = {}
    this.dbxImageList = []
    this.scanTimer = null
    this.photoTimer = null
    this.imageCursor = 0
    this.imageNextCursor = 0
    this.isPhotoWorkerWorking = 0
  },

  socketNotificationReceived: function (noti, payload) {
    switch(noti) {
      case 'RESUME':
        this.resumeTimer();
        console.log('[DBXWLP] Resumed.')
        break;
      case 'INIT_CONFIG':
        this.startWorker(payload)
        console.log('[DBXWLP] Configuration is initialized.')
        break;
      case 'SUSPEND':
        this.suspendTimer();
        console.log('[DBXWLP] Suspended.')
        break;
    }
  },

  scanDropbox(aDirectories) {
    var filterPhoto = function(e) {
      if (e['.tag'] !== 'file') return 0
      if (typeof e.media_info == 'undefined') return 0
      if (typeof e.media_info.metadata == 'undefined') return 0
      if (e.media_info.metadata['.tag'] !== 'photo') return 0
      return 1
    }

    if (aDirectories.length <= 0) return
    var firstScanDirectories = 0
    if (this.firstScan == 1) {
      firstScanDirectories = aDirectories.length
    }
    for (var i in aDirectories) {
      var path = aDirectories[i]
      var FilesListFolderArg = {
        path: path,
        include_media_info:true,
      }
      console.log('[DBXWLP] SCANNING:', path)
      var self = this
      this.dbxImageList = []
      var dbx = new Dropbox({ accessToken: this.config.accessToken })
      dbx.filesListFolder(FilesListFolderArg)
        .then(function(response) { //get All images
            var entries = response.entries
            if (entries.length > 0) {
              entries = entries.filter(filterPhoto)
              entries.forEach(function(e) {
                var img = {}
                img.name = e.name
                img.path = e.path_lower
                img.id = e.id
                img.metadata = e.media_info.metadata
                img.time = (e.media_info.metadata.time_taken)
                  ? e.media_info.metadata.time_taken : e.server_modified
                img.dimensions = (e.media_info.metadata.dimensions)
                  ? e.media_info.metadata.dimensions : null
                self.dbxImageList.push(img)
              })
            }
            response = null
          })
        .then(function() { //after getting list of all images
          if(self.dbxImageList.length > 0) {
            self.dbxImageList.sort(mySort[self.config.sort])

            var idx = self.dbxImageList.indexOf(self.imageCursor)
            if (idx < 0) idx = 0
            self.imageCursor = idx
          }
          console.log('[DBXWLP] SCANNED:', self.dbxImageList.length)
          self.sendSocketNotification('SCANNED', self.dbxImageList.length)
          if (self.firstScan == 1) {
            firstScanDirectories--;
            if (firstScanDirectories <= 0) {
              self.firstScan = 0
              self.downloadPhoto()
            }
          }

        })
        .catch(function(error) {
          self.sendSocketNotification('SCAN_ERROR', path)
          console.log('[DBXWLP] DOWNLOAD_ERROR', path)
          if (this.firstScan == 1) {
            firstScanDirectories--;
          }
        })
      dbx = null
    }
  },

  downloadPhoto: function() {
    if(this.dbxImageList.length <= 0) {
      console.log('[DBXPIC] No scanned images in Dropbox.')
      return
    }

    if (this.imageCursor >= this.dbxImageList.length) {
      console.log('[DBXPIC] Return cursor to begining.')
      if(this.config.sort == 'byRandom') {
        this.dbxImageList.sort(this.byRandom)
      }
      this.imageCursor = 0
    }

    var img = this.dbxImageList[this.imageCursor]
    if (typeof img.path !== 'undefined') {
      var FilesDownloadArg = {
        path:img.path
      }
      var self = this
      var dbx = new Dropbox({ accessToken: this.config.accessToken })
      dbx.filesDownload(FilesDownloadArg)
        .then(function(data){
          fs.writeFileSync(path.join(STORE, 'cached'), data.fileBinary, 'binary')
          if (self.imageCursor < self.dbxImageList.length) {
            self.imageCursor++
          } else {
            self.imageCursor = 0
          }
          data = null
          self.sendSocketNotification('PHOTO_DOWNLOADED', img)
          console.log("[DBXWLP] Photo is downloaded.", img.path)
        })
        .catch(function(error) {
          self.sendSocketNotification('DOWNLOAD_ERROR', img.path)
          console.log('[DBXWLP] DOWNLOAD_ERROR', img.path, error)
        })

    } else {
      console.log("[DBXWLP] Nothing to prepare")
    }
    dbx = null
  },



  startWorker: function(config) {
    this.firstScan = 1
    this.dbxImageList = []
    this.imageCursor = 0
    this.imageNextCursor = 0
    this.isPhotoWorkerWorking = 0
    this.config = config

    this.suspendTimer()

    this.scanDropbox(this.config.directories)

    this.resumeTimer()

    this.sendSocketNotification('INITIALIZED')
  },

  suspendTimer: function() {
    clearInterval(this.scanTimer)
    clearInterval(this.photoTimer)
    this.scanTimer = null
    this.photoTimer = null
  },

  resumeTimer: function() {
    this.suspendTimer()
    var self = this
    this.scanTimer = setInterval(function(){
      self.scanDropbox(self.config.directories)
    }, this.config.scanIntervalSec * 1000)

    this.photoTimer = setInterval(function(){
      self.downloadPhoto()
    }, this.config.drawIntervalSec * 1000)
  }
})
