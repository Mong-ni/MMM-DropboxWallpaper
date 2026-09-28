
const fetch = require('node-fetch') // Dropbox official SDK requires node-fetch, built-in fetch is not working at this moment.
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const fs = require('fs')
const { Dropbox } = require('dropbox')
const exifr = require('exifr')

const STORE = path.join(__dirname, 'cache')
const LOCATIONIQ_URL = 'https://us1.locationiq.org/v1/reverse?'

var log = () => { }

const NodeHelper = require('node_helper')
module.exports = NodeHelper.create({
  start: function () {
    this.credentials = require('./credentials.json')
  },

  socketNotificationReceived: async function (noti, payload) {
    switch(noti) {
      case 'INITIALIZE':
        this.initializeAfterLoading()
        break
      case 'SCAN':
        const r = await this.scan(payload)
        this.sendSocketNotification('SCANNED', r)
        break
      case 'SERVE':
        await this.serve(payload)
        break
    }
  },

  initializeAfterLoading: function() {
    log('[DBXWLP] Configuration is initialized.')
    const options = {
      fetch,
      accessToken: this.credentials.access_token,
      refreshToken: this.credentials.refresh_token,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
    }
    this.dbx = new Dropbox(options)
    log('[DBXWLP] Dropbox SDK is initialized.')
    this.sendSocketNotification('INITIALIZED')
  },

  scan: async function (options) {
    log = (options.verbose) ? console.log : () => { }
    const definedSort = [ 'relevance', 'last_modified_time' ]
    const scanned = []
    const searchOptions = {
      path: options.directory,
      file_categories: [ { '.tag': 'image' } ],
      file_status: { '.tag': 'active' },
      filename_only: false,
      max_results: 500,
      file_extensions: options.fileExtensions,
    }
    if (definedSort.includes(options.sort)) searchOptions.order_by = { '.tag': options.sort }

    const processItem = async (item) => {
      if (item[ '.tag' ] !== 'file') return
      if (!item.is_downloadable) return
      scanned.push(item)
      return
    }

    const continueScan = async({ cursor, has_more }) => {
      if (!(cursor && has_more)) {
        log('[DBXWLP] Scan finished.')
        return
      }
      log(`[DBXWLP] Continue scan... (cursor:${cursor})`)
      try {
        const { result } = await this.dbx.filesSearchContinueV2({ cursor })
        for (const i in result.matches) {
          const item = result.matches[i]
          await processItem(item.metadata.metadata)
        }
        return await continueScan(result)
      } catch (err) {
        throw err
      } finally {
        return
      }
    }

    try {
      log('[DBXWLP] Starting scan.')
      const { result } = await this.dbx.filesSearchV2({
        query: 'image',
        options: searchOptions,
      })
      for (const i in result.matches) {
        const item = result.matches[ i ]
        await processItem(item.metadata.metadata)
      }
      await continueScan(result)
    } catch (err) {
      console.error(err)
    } finally {
      log(`[DBXWLP] ${scanned.length} files are matched, but will be filtered on the module.`)
      return { scanned }
    }
  },

  serve: async function ({ item, options }) {
    const filePath = path.join(STORE, "temp")
    try {
      const tryThumbnail = async (item, options) => {
        try {
          if (!options.thumbnail) return false
          const availableThumbnailSizes = [ '32x32', '64x64', '128x128', '256x256', '480x320', '640x480', '960x640', '1024x768', '2048x1536' ]
          const thumbnailSize = availableThumbnailSizes.find((s) => { return s === options.thumbnail })
          if (!thumbnailSize) return false
          const size = 'w' + thumbnailSize.replace('x', 'h')
          const result = await this.dbx.filesGetThumbnailV2({
            resource: { path: item.path_lower, '.tag': 'path' },
            format: { '.tag': 'jpeg' },
            size: { '.tag': size },
            mode: { '.tag': 'fitone_bestfit' },
          })
          return result
        } catch (err) {
          log(`[DBXWLP] Failed to download thumbnail.`, err)
          log(`[DBXWLP] Trying to download original file.`)
          return false
        }
      }
      const getReverseGeocode = async function ({ latitude = null, longitude = null } = {}) {
        const useReverseGeocoding = process.env.LOCATIONIQ_TOKEN && options.reverseGeocoding
        if (!useReverseGeocoding || !(latitude && longitude)) return null
        const res = await fetch(LOCATIONIQ_URL + new URLSearchParams({
          format: 'json',
          key: process.env.LOCATIONIQ_TOKEN,
          lat: latitude,
          lon: longitude,
          normalizeaddress: 1,
          normalizecity: 1,
          "accept-language": options.locale,
        }))
        const data = await res.json()
        return (data?.address) ? data.address : {}
      }
      let result = await tryThumbnail(item, options)
      if (!result) result = await this.dbx.filesDownload({ path: item.path_lower })

      if (result?.status !== 200) throw new Error(`Failed to download. (status:${result.status})`)

      const metadata  = await this.dbx.filesGetMetadata({
        path: item.path_lower,
        include_media_info: true,
      })

      if (metadata?.result?.media_info?.metadata) {
        item.media_info = metadata.result.media_info
      }

      fs.writeFileSync(filePath, result.result.fileBinary)

      log("[DBXWLP]", item.name, "is downloaded.")
      const timeStamp = Date.now()
      const url = '/modules/MMM-DropboxWallpaper/cache/temp?' + timeStamp
      const exif = await exifr.parse(filePath)
      const location = await getReverseGeocode(item?.media_info?.metadata?.location ?? exif)
      const serving = {
        item,
        filePath,
        url,
        exif,
        location,
        timeStamp,
      }
      this.sendSocketNotification('SERVED', { serving })
      log('[DBXWLP] Serving:', item.name)
    } catch (err) {
      log(`[DBXWLP] ${item.name} failed to serve.`, err)
      console.error(err.stack)
      this.sendSocketNotification('SERVE_FAILED', { item, err })
    } finally {
      return
    }
  },
})
