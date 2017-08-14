/* Magic Mirror
* Module: MMM-DropboxPictures
*
* By eouia
*/

function loadJSON(path, success, error) {
  var xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        if (success) success(JSON.parse(xhr.responseText))
      } else {
        if (error) error(xhr)
      }
    }
  }
  xhr.open("GET", path, true)
  xhr.send()
}

const PROFILE_TEMPLATE = {
	accessToken: "",
	directories: [],
	scanIntervalSec: 30*60,
	sort: "byRandom",
	drawIntervalSec: 10, //minimum 10
	mode:'hybrid',
	showInfo: 1,
	dateTimeFormat: "YYYY MMMM Do, HH:mm",
}



Module.register("MMM-DropboxWallpaper",{
	defaults: {
		startProfile: "default",
		tokenLocationIQ : "",
		profiles: {
			"default": {},
		},
	},

	getScripts: function() {
		return ["moment.js"]
	},

	getStyles: function() {
		return ["MMM-DropboxWallpaper.css"]
	},

	start: function() {
		this.CurCfg = {}
		this.curImg
		var profileConfig = {}

		if (!this.config.startProfile) this.config.startProfile = 'default'
		if (typeof this.config.profiles[this.config.startProfile] == 'undefined') {
			profileConfig = this.defaults.profiles[this.config.startProfile]
		} else {
			profileConfig = this.config.profiles[this.config.startProfile]
		}
		this.loadConfig(profileConfig)

	},

  suspend: function() {
    this.sendSocketNotification('SUSPEND')
  },

  resume: function() {
    this.sendSocketNotification('RESUME', this.CurCfg)
  },

	getDom: function() {
		var wrapper = document.createElement("div")
		wrapper.className = "DBXWLP"
    wrapper.id = "DBXWLP_WRAPPER"
    return wrapper
	},

  notificationReceived(noti, payload) {
    switch (noti) {
      case 'CHANGED_PROFILE':
        if(this.config.startProfile !== payload.to) {
          this.config.startProfile = payload.to
          this.start()
        }
        break;
      default:
        break;
    }
  },

	socketNotificationReceived(noti, payload) {
		switch(noti) {
			case 'PHOTO_DOWNLOADED':
				this.curImg = payload;
				this.updateView()
				break;
		}
	},

  updateView: function() {
    var wrapper = document.getElementById("DBXWLP_WRAPPER")
    var wrpRatio = (wrapper.offsetHeight < wrapper.offsetWidth) ? 'h' : 'v'

    if (!this.curImg) return
    if (wrapper.firstChild) {
      wrapper.firstChild.className = 'photo disappear'
    }

    var photo = document.createElement("div")
    photo.style.backgroundImage
			= "url('modules/MMM-DropboxWallpaper/cache/cached?"
			+ this.curImg.name
			+ "')"

    if (this.CurCfg.mode == 'hybrid') {
      var imgRatio = (
        this.curImg.metadata.dimensions.height
        < this.curImg.metadata.dimensions.width
      ) ? 'h' : 'v'
      photo.style.backgroundSize = (imgRatio == wrpRatio) ? 'cover' : 'contain'
    } else {
      photo.style.backgroundSize = this.CurCfg.mode
    }

    photo.className = "photo appear"

    var infoWrapper = document.createElement("div")
    infoWrapper.className = "info"
    var dateWrapper = document.createElement("div")
    dateWrapper.className = "time"
    var locationWrapper = document.createElement("div")
    locationWrapper.className = "location"

		if (typeof this.curImg.time !== 'undefined') {
  		dateWrapper.innerHTML = moment(this.curImg.time).format(this.CurCfg.dateTimeFormat)
    }

		if (typeof this.curImg.metadata.location !== 'undefined') {
      if (
  			typeof this.curImg.metadata.location.latitude !== 'undefined'
  			&& typeof this.curImg.metadata.location.longitude !== 'undefined'
  		) {
    		if (this.config.tokenLocationIQ !== '') {
    			var query = "http://locationiq.org/v1/reverse.php?format=json&key="
    				+ this.config.tokenLocationIQ
    				+ "&lat=" + this.curImg.metadata.location.latitude
    				+ "&lon=" + this.curImg.metadata.location.longitude
    			loadJSON(query, function(data){
            var loc = ""
            var part = ""

            var level = [
              'hotel', , 'pedestrian', 'stadium', 'university', 'public',
              'manor', 'memorial', 'monument', 'ruins', 'tower', 'beach_resort',
              'garden', 'marina', 'park', 'american_football', 'baseball',
              'golf', 'multi', 'building', 'aquarium', 'artwork', 'attraction',
              'museum', 'theme_park', 'viewpoint', 'zoo', 'castle', 'fort',
              'gallery'
            ]
            level.forEach(function(s) {
              if(typeof data.address[s] !== 'undefined') part = data.address[s]
            })
            loc += ((part) ? (part + ", ") : "")

            part = ""
            var level = [
              'hamlet', 'isolated_dwelling', 'farm', 'allotments',
              'plot', 'city_block', 'neighbourhood', 'quarter',
              'suburb', 'borough', 'village', 'town', 'city'
            ]
            level.forEach(function(s) {
              if(typeof data.address[s] !== 'undefined') part = data.address[s]
            })
            loc += ((part) ? (part + ", ") : "")

            part = ""
            var level = [
              'state', 'region', 'province', 'district', 'county', 'municipality'
            ]
            level.forEach(function(s) {
              if(typeof data.address[s] !== 'undefined') part = data.address[s]
            })
            loc += ((part) ? (part + ", ") : "")

            loc += data.address.country_code.toUpperCase()
    				locationWrapper.innerHTML = loc
    			}, function(err) {console.log(err)})
    		}
      }
		}
    infoWrapper.appendChild(dateWrapper)
		infoWrapper.appendChild(locationWrapper)
		photo.appendChild(infoWrapper)

    wrapper.insertBefore(photo, wrapper.firstChild)
    if (wrapper.childNodes.length > 2) {
      wrapper.removeChild(wrapper.lastChild)
    }
  },


	loadConfig: function(cfg) {
		this.CurCfg = Object.assign({}, PROFILE_TEMPLATE, cfg)

		if (this.CurCfg.scanIntervalSec < 60) this.CurCfg.scanIntervalSec = 60
		if (this.CurCfg.drawIntervalSec < 10) this.CurCfg.drawIntervalSec = 10
		if (this.CurCfg.drawIntervalSec > this.CurCfg.scanIntervalSec) {
			this.CurCfg.drawIntervalSec = this.CurCfg.scanIntervalSec
		}
		if (!this.CurCfg.sort.match(/byTime|byTimeReverse|byName|byNameReverse|byRandom/gi)) {
			this.CurCfg.sort = 'byRandom'
		}
		this.sendSocketNotification('INIT_CONFIG', this.CurCfg)
	},
})
