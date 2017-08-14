# MMM-DropboxWallpaper
Module for `MagicMirror` which can show image from `Dropbox`

## Screenshot
![](https://github.com/eouia/MMM-DropboxWallpaper/blob/master/sc.jpg?raw=true)

## Features and Information
This module can download an image from Dropbox and use it as fullscreen wallpaper.

### This module is fit for...
- Who has not sufficient storage on his Raspberry Pi.
- Who has tons of images already in `Dropbox` and wants to show most of them.
- Who is not familiar with `FTP`/`SFTP`/`NETATALK`/`SAMBA`, ... So he just wants to throw his image into a dropbox folder simply.
- Who share the photos with others, and want to manage showing their photos on `MM` easily.

**Notice**
Usually, storing photos in local RPI storage and using [`MMM-RandomPhoto`](https://github.com/diego-vieira/MMM-RandomPhoto) or [`MMM-RandomBackground`](https://github.com/Ultimatum22/MMM-RandomBackground) is better way to use wallpaper. <br>
This module has a very shallow niche purpose, especially for my wife. :P 

## Installation
```shell
cd ~/MagicMirror/modules
git clone https://github.com/eouia/MMM-DropboxWallpaper.git
cd MMM-DropboxWallpaper
npm install
```

## Configuration
### 1. get Dropbox accessToken
1. Visit https://www.dropbox.com/developers and login.
1. Select `My App` on left, then press `CREATE APP` button.
  - Choose An API - `Dropbox API`
  - Choose the type of access you need - `App folder` or `Full Dropbox` <br> Anything is Okay. If you want to use directories already existed, select `Full Dropbox`.
  - Name Your App with Anything.
  - Press `CREATE`
1. Select `My App` again, You can see your app just created. Select it.
1. In the right section, You can see `Generated access token` and `Generate` Button. Click and you can get your accessToken. Remember it.

### 2. get locationIQ API Key
1. Visit http://locationiq.org/#register and sign up.
1. You can get key on page or could received via mail. Also remember it.

### 3. `config.js`
```javascript
{
  module: 'MMM-DropboxWallpaper',
  position: 'fullscreen_below', // fullscreen_below is the best position.
  classes: "default everyone", // when you use MMM-ProfileSwitcher.
  config: {
    startProfile:"default",
    tokenLocationIQ: "<YOUR_LOCATIONIQ_KEY>", //edit here.
    profiles: { // At least, "default" profile SHOULD exist.
      "default" : { // default profile is REQUIRED
        accessToken: '<YOUR_DROPBOX_API_KEY>', //edit here. REQUIRED
        directories: ['/MySharedPhoto/family', '/MyPrivaePhoto'], //array of directory path which has photos. REQUIRED
        mode:'hybrid', //'cover', 'contain', 'hybrid' are available.
        sort:'byRandom', //'byRandom', 'byName', 'byNameReverse', 'byTime', 'byTimeReverse' are available.
      },
      "MySon" : {
        accessToken: '<MY_SONS_DROPBOX_API_KEY>', //Well, someone wants not to share dropbox itself but wants to display photo. I don't know why...
        directories: ['/hisDropboxDirectory'],
        scanIntervalSec: 3600, // interval for detecting change of dropbox. I don't recommend too short interval.
        drawIntervalSec: 60, // interval for changing photos on screen. I don't also recommend too short interval.
        dateTimeFormat: "Do MMM" // for information of Photos.
      },
      "PartyMode" : {
        accessToken: '<YOUR_DROPBOX_API_KEY>',
        directories: ['/MyDropbox/wedding', '/MyDropbox/divorcing', ...],
        mode:'hybrid',
        sort:'byRandom',
        ...
      }
    },
  }
},

```

This module supports `MMM-ProfileSwitcher` or any other module which can broadcast `CHANGED_PROFILE` notification.

Available Config fields and default values;
```javascript
startProfile:"default",
tokenLocationIQ: "", //Not REQUIRED but RECOMMENDED for displaying additional information of photos.

profiles: [
"<profile name>" { // At least, `default` profile SHOULD be here.
	accessToken: "", // REQUIRED
	directories: [], // REQUIRED
	scanIntervalSec: 30*60,
	sort: "byRandom",
	drawIntervalSec: 60, 
	mode:'hybrid',
	dateTimeFormat: "YYYY MMMM Do, HH:mm",
},
... // You can add additional profile configurations.
]
```

#### about `.mode`
You can get information about `cover` and `contain` in here : https://css-tricks.com/almanac/properties/b/background-size/#article-header-id-0
Both of mode have some demerits.
- `cover` : cover whole screen. However you cannot see entire the photo but only some portion. Especially, when the Height/Width ratio of photo is different with that of screen, you could just see only little part of photo.
- `contain` : contain whole photo and fit to screen. However you can see additional black stripe around the photo for fitting size to screen.

- `hybrid` : By the ratio of W/H of photo and comparing with those of screen, this option could change mode automatically between 'cover' and 'contain'.

