/* Magic Mirror
* Module: MMM-DropboxWallpaper
* v2.0.0
*
* By eouia
*/


Module.register("MMM-DropboxWallpaper",{
  defaults: {
    refreshInterval: 1000*60,
    search: [".jpg", ".png", ".gif"], // Or you can find target files like "FILENAME". (wildcard or regexp not supported)
    directory: "/", // root of directories to be scanned.
    sort: "random", //"time09", "time90", "nameAZ", "nameZA""random"
    tokenLocationIQ : "", // See http://locationiq.org/#register
    dropboxAccessToken: "",
    width: "100%", // 'px' or '%' or valid value for CSS dimensions units.
    height: "100%",
    mode: "cover", // 'cover', 'contain', 'hybrid' or any other values for CSS `background-size`
    dateTimeFormat: "HH:mm MMM Do, YYYY", // See. moment.js .format()
  },

  getStyles: function() {
    return ["MMM-DropboxWallpaper.css"]
  },

  start: function() {

  },


  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.id = "DBXWLP_CONTAINER"
    wrapper.style.width = this.config.width
		wrapper.style.height = this.config.height
    var bg = document.createElement("div")
    bg.id = "DBXWLP"
    bg.style.width = this.config.width
		bg.style.height = this.config.height

    var info = document.createElement("div")
    info.id = "DBXWLP_INFO"

    var date = document.createElement("div")
    date.id = "DBXWLP_DATE"

    var location = document.createElement("div")
    location.id = "DBXWLP_LOCATION"

    info.appendChild(date)
    info.appendChild(location)
    wrapper.appendChild(bg)
    wrapper.appendChild(info)
    return wrapper
  },

  notificationReceived: function(noti, payload, sender) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification('INIT_CONFIG', this.config)
        break
    }
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case 'NEW_PHOTO':
        this.updateView(payload)
        break;
    }
  },

  updateView: function(photo) {
    const tr = [
      "",
      "",
      "rotateY(180deg)",
      "rotate(180deg)",
      "rotateX(180deg)",
      "rotate(270deg) rotateY(180deg)",
      "rotate(90deg)",
      "rotateX(180deg) rotate(90deg)",
      "rotate(270deg)",
    ]
    var wrapper = document.getElementById("DBXWLP")
    wrapper.className += " fo"

    var wrpRatio = (wrapper.offsetHeight < wrapper.offsetWidth) ? 'h' : 'v'
    //var height = photo.dimensions.height
    //var width = photo.dimensions.width

    var height = (photo.orientation > 4) ? photo.dimensions.width : photo.dimensions.height
    var width = (photo.orientation > 4) ? photo.dimensions.height : photo.dimensions.width
    var mode = this.config.mode
    if (this.config.mode == 'hybrid') {
      var imgRatio = ( height < width) ? 'h' : 'v'
      mode = (imgRatio == wrpRatio) ? 'cover' : 'contain'
    }
    wrapper.style.backgroundSize = this.config.mode

    var timer = setTimeout(()=>{
      wrapper.style.backgroundImage = "none"
      wrapper.className = "tr_" + photo.orientation

      //console.log(width, height, wrapper.offsetHeight, wrapper.offsetWidth)

      //wrapper.style.backgroundSize = zoom + "%"



      wrapper.style.backgroundImage
        = "url('modules/MMM-DropboxWallpaper/cache/temp?"
        + Date.now()
        + "')"


      var zoom = Math.round(width * width / height / height * 100) / 100
      var scale = ""

      if (mode == "cover") {
        scale = (photo.orientation == 1) ? "" : " scale(" + zoom + ")"
      }
      wrapper.style.transform = tr[photo.orientation] + scale
      //console.log(tr[photo.orientation], wrapper.style.transform)
      var date = document.getElementById("DBXWLP_DATE")
      var location = document.getElementById("DBXWLP_LOCATION")

      date.innerHTML = (typeof photo.time !== "undefined") ? photo.time : ""
      location.innerHTML = (typeof photo.locationText !== "undefined") ? photo.locationText : ""
    }, 2000)
  },

})
