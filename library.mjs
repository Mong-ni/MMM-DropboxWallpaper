let log = () => { }

class ImageList {
  #options = {}
  #images = []
  #serving = null
  #index = 0
  #errors = 0
  constructor(options) {
    this.#options = options
    if (options.verbose) log = console.log
  }

  loadScanned(scanned) {
    const {fileSizeMinMax, clientModifiedTimeMinMax, serverModifiedTimeMinMax, fileExtensions, fileNames, sort} = this.#options
    const sorter = (a, b) => {
      if (typeof sort === 'function') return sort(a, b)
      if (sort === 'random') return Math.random() - 0.5
      if (sort === 'filenameASC') return a.name.localeCompare(b.name)
      if (sort === 'filenameDESC') return b.name.localeCompare(a.name)
      if (sort === 'serverTimeASC') return a.server_modified.localeCompare(b.server_modified)
      if (sort === 'serverTimeDESC') return b.server_modified.localeCompare(a.server_modified)
      if (sort === 'clientTimeASC') return a.client_modified.localeCompare(b.client_modified)
      if (sort === 'clientTimeDESC') return b.client_modified.localeCompare(a.client_modified)
      return 0
    }
    const validSize = (size) => {
      const res = (size >= fileSizeMinMax[ 0 ] && size <= fileSizeMinMax[ 1 ])
      //if (!res) log((`[DBXWLP] ${size} is out of range. (fileSizeMinMax:${fileSizeMinMax})`)
      return res
    }
    const validTime = (time, range) => {
      const t = new Date(time)
      const r = range.map((v) => new Date(v)) 
      const res = (t.valueOf() >= r[ 0 ].valueOf() && t <= r[ 1 ].valueOf())
      //if (!res) log(`[DBXWLP] ${t} is out of range. (timeMinMax:${range})`)
      return res
    }
    this.#images = scanned.filter((i) => {
      return (
        validSize(i.size)
        && validTime(i.client_modified, clientModifiedTimeMinMax)
        && validTime(i.server_modified, serverModifiedTimeMinMax)
        && fileExtensions.includes(i.name.split('.').pop().toLowerCase())
        && (fileNames.length === 0 || fileNames.some((f) => {
          const r = new RegExp(f.source, f.flags)
          return r.test(i.name)
        }))
      )
    }).sort(sorter).map((i, index) => {
      i.index = index
      return i
    })
    if (this.#images.length > this.#options.maxImages) {
      log(`[DBXWLP] Too many images will be cut. (maxImages:${this.#options.maxImages}, images:${this.#images.length})`)
      this.#images.length = this.#options.maxImages
    }
    if (this.#images.length <= 0) {
      log('[DBXWLP] No image to serve.')
    }
    this.#index = 0
  }

  getList() {
    return this.#images
  }

  servable() {
    return this.#images.length > 0
  }

  getLength() {
    return this.#images.length
  }

  getOptions() {
    return { ...this.#options }
  }

  getIndex() {
    return this.#index
  }

  activate(step = 0) {
    this.#index = (this.#index + step) % this.#images.length
    return this.#images[ this.#index ]
  }

  serve(serving) {
    return new Promise((resolve, reject) => {
      if (!serving) reject()
      const { filePath, item, location, url, exif } = serving
      const img = document.createElement("img")
      img.src = url
      img.onload = () => {
        this.#serving = { ...serving, img }
        resolve()
      }
      img.onerror = reject
    })
  }

  getServing() {
    return this.#serving
  }

  isFinal() {
    return (this.#index >= this.#images.length - 1)
  }

  hideOnFinish() {
    return this.#options.hideOnFinish
  }

  rescanLoop() {
    return this.#options.rescanLoop
  }

  getObjectFit(container) {
    if (this.#options.objectFit !== 'auto') return this.#options.objectFit
    const { img } = this.#serving
    const imageRatio = ((img.width / img.height) > 1) ? 'landscape' : 'portrait'
    const {width, height} = container.getBoundingClientRect()
    const screenRatio = ((width / height > 1)) ? 'landscape' : 'portrait'
    return (imageRatio === screenRatio) ? 'cover' : 'contain'
  }

  fillBackground(container) {
    if (!this.#options.fillBackground) return
    container.classList.remove('enter', 'exit')
    container.classList.add('fillBackground')
    container.classList.add('exit')
    container.onanimationend = () => {
      container.onanimationend = null
      container.classList.remove('exit')
      container.classList.add('enter')
      container.style.setProperty('--backgroundImage', `url(${this.#serving.url})`)
    }
  }

  showInformation(container) {
    if (!this.#options.showInformation) return
    if (typeof this.#options.showInformation === 'function') {
      const prev = container.querySelector('.info')
      if (prev) container.removeChild(prev)
      const info = document.createElement("div")
      info.classList.add('info')
      info.innerHTML = this.#options.showInformation({
        location: { ...this.#serving.location },
        exif: { ...this.#serving.exif },
        item: { ...this.#serving.item },
        options: {
          locale: this.#options.locale,
          datetimeFormat: this.#options.datetimeFormat,
        }
      })
      container.appendChild(info)
    }
  }

  shutdown() {
    this.#images = []
    this.#serving = null
    this.#index = 0
  }

  callback(message, ...args) {
    if (typeof this.#options.callback === 'function') this.#options.callback(message, ...args)
  }
  
  autostart() {
    return this.#options.autostart
  }
}

class Timer {
  #timer = null
  #remaining = 0
  #startTime = 0
  #callback = null
  #paused = false

  constructor() {
    this.#init()
  }

  #clearTimer() {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
  }

  #init() {
    this.#clearTimer()
    this.#timer = null
    this.#remaining = 0
    this.#startTime = 0
    this.#callback = null
    this.#paused = false
  }

  start(callback, delay) {
    this.#clearTimer()
    this.#startTime = Date.now()
    this.#callback = callback
    this.#timer = setTimeout(callback, delay)
  }

  stop() {
    this.#init()
  }

  pause() {
    this.#clearTimer()
    this.#remaining = Date.now() - this.#startTime
    this.#paused = true
  }

  resume() {
    if (!this.#paused) return false
    this.#clearTimer()
    this.#timer = setTimeout(this.#callback, this.#remaining)
    return true
  }
}


export { ImageList, Timer}