/* global Module Log config Mconfig */
/* Magic Mirror
* Module: MMM-DropboxWallpaper
* v3.0.0
*
* By eouia
*/

Module.register("MMM-DropboxWallpaper", {
  defaults: {
    width: "100%",
    height: "100%",
    verbose: false,
    autostart: true,
    imageLife: 1000 * 60,
    directory: "", // root of directories to be scanned.
    fileExtensions: [
      "jpg", "jpeg", "png", "gif", "bmp",
      "webp", "apng", "svg", "avif", "tiff",
      "jtif", "pjpeg", "pjp",
    ],
    fileNames: [],
    fileSizeMinMax: [ 10_000, 10_000_000 ], // [min, max] (bytes)
    serverModifiedTimeMinMax: [ "1980-01-01", "2100-12-31" ],
    clientModifiedTimeMinMax: [ "1980-01-01", "2100-12-31" ],
    sort: 'random', // 'relevance', 'last_modified_time', 'random', 'filenameASC', 'filenameDESC', 'serverTimeASC', 'serverTimeDESC', 'clientTimeASC', 'clientTimeDESC'
    // sort: () => {}, // custom sort function

    objectFit: 'auto', // 'cover', 'contain', 'auto',
    fillBackground: true, // true or false
    rescanLoop: true, // true or false

    hideOnFinish: false,
    maxImages: 3000,

    datetimeFormat: { dateStyle: "short", timeStyle: "short" }, //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
    locale: null, // null, 'en-US'
    reverseGeocoding: true,
    showInformation: ({ location, item, exif, options }) => {
      const createdAt = new Date(item?.media_info?.metadata?.time_taken ?? exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.CreateDate ?? item?.server_modified ?? item?.client_modified)
      const date = new Intl.DateTimeFormat(options.locale, options.datetimeFormat).formatToParts(createdAt).reduce((prev, cur, curIndex, arr) => {
        prev = prev + `<span class="timeParts ${cur.type} seq_${curIndex} ${cur.source}">${cur.value}</span>`
        return prev
      }, '')
      return `<div class="date">${date}</div>`
      + ((location?.city)
        ? `<div class="address"><span class="addressParts city">${location?.city}</span> <span class="addresParts country">${location?.country}</span></div>`
        : ''
      )
    },
    popoverExif: false, // Reserved for future.
    callback: () => { },
    thumbnail: '2048x1536', //false, '32x32', '64x64', '128x128', '256x256', '480x320', '640x480', '960x640', '1024x768', '2048x1536'
  },

  getStyles: function () {
    return [ "MMM-DropboxWallpaper.css" ]
  },

  start: async function () {
    this.modules = await import('./library.mjs')
    this.images = null
    this.index = 0
    this.originalConfig = { ...this.regularizeConfig(this.config) }
    this.activeConfig = { ...this.originalConfig }
    this.sendSocketNotification('INITIALIZE')
    this.running = this.activeConfig.autostart
    this.timer = new this.modules.Timer()
    this.log = (this.activeConfig.verbose) ? console.log : () => { }
  },

  regularizeConfig: function (options) {
    options = { ...this.defaults, ...options }
    options.imageLife = Math.max(options.imageLife, 1000 * 10)
    if (typeof options.fileNames === 'string') options.fileNames = [ options.fileNames ]
    if (Array.isArray(options.fileNames)) {
      options.fileNames = options.fileNames.map((f) => {
        const r = (f instanceof RegExp) ? f : new RegExp(f)
        return {
          source: r.source,
          flags: r.flags,
        }
      })
    }
    options.fileSizeMinMax = (Array.isArray(options.fileSizeMinMax) && options.fileSizeMinMax.length == 2 && options.fileSizeMinMax.every((v) => !isNaN(v)))
    ? options.fileSizeMinMax : this.defaults.fileSizeMinMax
    const isValidTime = (v) => {
      return v && isNaN(v)
    }
    options.clientModifiedTimeMinMax = (Array.isArray(options.clientModifiedTimeMinMax) && options.clientModifiedTimeMinMax.length == 2 && options.clientModifiedTimeMinMax.every((v) => isValidTime(v)))
      ? options.clientModifiedTimeMinMax : this.defaults.clientModifiedTimeMinMax
    options.serverModifiedTimeMinMax = (Array.isArray(options.serverModifiedTimeMinMax) && options.serverModifiedTimeMinMax.length == 2 && options.serverModifiedTimeMinMax.every((v) => isValidTime(v))) ?
      options.serverModifiedTimeMinMax : this.defaults.serverModifiedTimeMinMax

    options.locale = Intl.getCanonicalLocales(options.locale ?? config.language ?? config.locale)?.[ 0 ] ?? ''
    options.callback = (typeof options.callback === 'function') ? options.callback : () => { }
    return options
  },



  prepare: function (config = null) {
    if (typeof config === 'object') this.activeConfig = { ...config }
    const { ImageList } = this.modules
    this.images = new ImageList(this.activeConfig)
    this.log('[DBXWLP] Prepare to scan.')
    this.errors = 0
    this.sendSocketNotification('SCAN', this.images.getOptions())
  },

  notificationReceived: function(noti, payload, sender) {
    switch (noti) {
      case 'DBXWLP_SCAN':
        this.log(`[DBXWLP] External request to scan. Current serving is finished.`)
        this.prepare(this.regularizeConfig(payload))
        break
      case 'DBXWLP_RESET':
        this.log(`[DBXWLP] External request to reset. Current serving is finished.`)
        this.prepare(this.originalConfig)
        break
      case 'DBXWLP_PAUSE':
        this.log(`[DBXWLP] External request to stop. Current serving will pause.`)
        this.timer.pause()
        this.sendNotification('DBXWLP_PAUSED')
        this.images.callback('paused', {...this.images.getServing()})
        break
      case 'DBXWLP_RESUME':
        this.log(`[DBXWLP] External request to resume. Current serving will resume.`)
        this.sendNotification('DBXWLP_RESUME_REQUESTED')
        if (!this.timer.resume()) {
          this.log(`[DBXWLP] Wrong request to resume. This request will be ignored.`)
        } else {
          this.sendNotification('DBXWLP_RESUMED')
          this.images.callback('resumed', {...this.images.getServing()})
        }
        break
      case 'DBXWLP_NEXT':
        this.log(`[DBXWLP] External request to next.`)
        if (this.images.servable()) {
          this.sendSocketNotification('SERVE', {
            item: this.images.activate(1),
            options: this.images.getOptions()
          })
        }
        break
      case 'DBXWLP_PREV':
        this.log(`[DBXWLP] External request to prev.`)
        if (this.images.servable()) {
          this.sendSocketNotification('SERVE', {
            item: this.images.activate(-1),
            options: this.images.getOptions()
          })
        }
        break
    }
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case 'SCANNED':
        //this.images = new ImageList(payload?.options ?? this.activeConfig)
        //this.resetView()
        this.images.loadScanned(payload?.scanned ?? [])
        if (this.images.servable()) {
          if (this.images.autostart()) {
            this.sendSocketNotification('SERVE', {
              item: this.images.activate(0),
              options: this.images.getOptions()
            })
          }
        } else {
          this.log('[DBXWLP] Scanned images are not servable.')
        }
        this.images.callback('scanned', this.images.getList())
        break
      case 'SERVE_FAILED':
        this.onServeFailed(payload.item, payload.error)
        break
      case 'SERVED':
        this.images.serve(payload?.serving).then(() => {
          this.updateView()
        }).catch((e) => {
          console.error(e.stack)
          this.errors++
          if (this.errors > 5) {
            this.log('[DBXWLP] Too many errors. It will stop.')
            return
          }
          if (this.images.getLength() > 0) {
            this.log('[DBXWLP] Image is not loaded. It will request the next.')
            this.sendSocketNotification('SERVE', {
              item: this.images.activate(1),
              options: this.images.getOptions()
            })
          } else {
            this.log('[DBXWLP] No image to serve anymore.')
          }
        })
        break
      case 'INITIALIZED':
        this.log('[DBXWLP] MMM-DropboxWallpaper is ready.')
        this.prepare(this.originalConfig)
        break
    }
  },

  resetView: function () {
    this.timer.stop()
    this.updateDom()
  },

  updateView: function () {
    if (!this.images.servable()) return
    if (this.hidden) this.show('DBXWLP', () => { 
      this.log('[DBXWLP] Revealed.')
    }, { lockstring: 'DBXWLP_' + this.identifier })
    const options = this.images.getOptions()
    this.timer.stop()
    const r = this.replaceImage()
    if (this.images.getLength() <= 1) {
      this.log('[DBXWLP] No image to request the next.')
      return
    }
    if (this.images.isFinal()) {
      this.log('[DBXWLP] Reached the end of images.')
    }
    this.timer.start(() => {
      //TODO : how to handle the final image? (hide or rescan)
      if (this.images.isFinal() && this.images.hideOnFinish()) {
        this.hide('DBXWLP', () => {
          this.log('[DBXWLP] Hidden.')
        }, { lockstring: 'DBXWLP_' + this.identifier })
        return
      } else if (this.images.isFinal() && !this.images.rescanLoop()) {
        this.log('[DBXWLP] No more request.(rescanLoop:false)')
        return
      } else if (this.images.isFinal() && this.images.rescanLoop()) {
        this.log('[DBXWLP] Request the next after rescan.')
        this.sendSocketNotification('SCAN', this.images.getOptions())
      } else {
        this.log('[DBXWLP] Request the next.')
        this.sendSocketNotification('SERVE', {
          item: this.images.activate(1),
          options: this.images.getOptions()
        })
      }
    }, options.imageLife)
  },

  onServeFailed: function (item, error) {
    this.log(`[DBXWLP] ${item?.name} serve failed:`, error)
    this.errors++
    if (this.errors > 5) {
      this.log('[DBXWLP] Too many errors. It will stop.')
      //this.sendSocketNotification('SCAN', this.images.getOptions())
      return
    }
    this.images.callback('serveFailed', { item, error })
    this.sendSocketNotification('SERVE', {
      item: this.images.activate(1),
      options: this.images.getOptions()
    })
  },

  replaceImage: function () {
    const container = document.getElementById("DBXWLP_CONTAINER_" + this.identifier)
    const { img } = this.images?.getServing() ?? { img: null }
    if (img) {
      const previous = container.getElementsByClassName("picture")?.[ 0 ] || null
      if (previous) {
        previous.onanimationend = () => {
          previous.onanimationend = null
          container.removeChild(previous)
        }
        previous.classList.add("exit")
      }
      img.classList.add('picture')
      img.style.setProperty('--object-fit', this.images.getObjectFit(container))
      img.onanimationend = () => {
        img.ontransitionend = null
        img.classList.remove("enter")
      }
      container.append(img)
      img.classList.add("enter")
      this.images.fillBackground(container)
      this.images.showInformation(container)
      this.images.callback('served', {...this.images.getServing()})
    } else {
      this.log('[DBXWLP] No image to draw.')
      return false
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div")
    wrapper.classList.add("DBXWLP")
    wrapper.id = "DBXWLP_" + this.identifier
    wrapper.style.setProperty('--width', this.activeConfig.width)
    wrapper.style.setProperty('--height', this.activeConfig.height)
    const container = document.createElement("figure")
    container.classList.add("container")
    container.id = "DBXWLP_CONTAINER_" + this.identifier
    wrapper.appendChild(container)
    return wrapper
  },
})
