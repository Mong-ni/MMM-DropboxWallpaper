# MMM-DropboxWallpaper
Module for `MagicMirror` which can show images from `Dropbox`

## Screenshot
![](https://github.com/eouia/MMM-DropboxWallpaper/blob/master/sc.jpg?raw=true)

## Features and Information
This module can download images (one-by-one) from Dropbox and use it as fullscreen wallpaper.

### This module might be good for...
- Who has NOT SUFFICIENT storage on his Raspberry Pi.
- Who has TONS of images already in `Dropbox` and wants to show MOST of them.
- Who is not familiar with using `FTP`/`SFTP`/`NETATALK`/`SAMBA`, ... So he just wants to throw his image into a dropbox folder simply.
- Who share the photos with others, and want to manage showing their photos on `MM` easily.

**Notice**
Usually, storing photos in local RPI storage and using [`MMM-RandomPhoto`](https://github.com/diego-vieira/MMM-RandomPhoto) or [`MMM-RandomBackground`](https://github.com/Ultimatum22/MMM-RandomBackground) is better way to use wallpaper on RPI. <br>
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
  - Name your app with anything.
  - Press `CREATE`
1. Select `My App` again, You can see your app just created. Select it.
1. In the right section, You can see `Generated access token` and `Generate` button. Click and get your accessToken. Remember it.

### 2. get locationIQ API Key
1. Visit http://locationiq.org/#register and sign up.
1. You can get key on page or could receive via mail. Also remember it.

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

profiles: {
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
}
```

|fieldname |default value |description |
|--- |--- |--- |
|startProfile | 'default' | You can set which profile to use when `MM` starts. The default profile is 'default'. It means you SHOULD have `default` profile in your `profiles` configuration when you omit this. |
|tokenLocationIQ | '' | Not REQUIRED but RECOMMENDED. <br> Your photo might have some geometric informations like latitude and longitude. This module uses LocationIQ API for `reverse geocoding`. More detailed info is here. (http://locationiq.org/) |
|profiles | {'default':{...}, ...} | Your multi configurations locate here. If you are using `MMM-ProfileSwitcher`, you can use the profile-specific configuration for each profile. |

#### for each Profile 
|fieldname |default value |description |
|--- |--- |--- |
|accessToken |'' | If you want to use folders of 'wife', you should get an accessToken of dropbox account of 'wife'. Usually, You have already shared folders on YOUR dropbox account. So you just get YOUR accessToken. <br> However, sometimes people don't want to share there photos with you, but want to display their photo on your `MM`. (I don't know why.) In that case, you can use THEIR accessToken here. |
|directories | [] | Which directories to scan photos. This module doesn't scan subfolders. So if you want to use subfolder, you can write here. <br> e.g) `['/family_photos/mine', '/family_photos/mine/birthday', '/family_photos/john/graduation']`
|scanIntervalSec | 1800 (sec) | This module scans your `directories` periodically. |
|drawIntervalSec | 60 (sec) | This module downloads one image from `directories` and show. Then after this interval it would download the next image. Too short interval is not recommended. Because it needs some time to download image from Dropbox via internet. |
|sort | 'byRandom' | **Available values : `'byRandom'`, `'byTime'`, `'byTimeReverse'`, `'byName'`, `'byNameReverse'`** <br> `'byTime'` and `'byTimeReverse'` use photo taken time. but if the image has not, use server modified time. |
|dateTimeFormat | 'YYYY MMMM Do, HH:mm' | See https://momentjs.com/docs/#/displaying/format/ <br> Default value could show the photo taken time like '2017 August 15th, 12:34' or something similiar by your locale. |
|mode | 'hybrid' | **Available values : `'hybrid'`, `'contain'`, `'cover'`** <br> See the below |


#### about `.mode`
You can get information about `cover` and `contain` in here : https://css-tricks.com/almanac/properties/b/background-size/#article-header-id-0
Both of mode have some demerits.
- `cover` tells the browser to make sure the image **always covers the entire container**, even if it has to stretch the image or cut a little bit off one of the edges. 
- `contain`, on the other hand, says to **always show the whole image**, even if that leaves a little space to the sides or bottom.
- `hybrid` : By the ratio of W/H of photo and comparing with those of screen, this option could change mode automatically between 'cover' and 'contain'. 

Suppose your `MM` has a horizontal screen. 
- If your photo is also horizontal, `'cover'` is good option. This vertical photo with `cover` could be shown pretty on entire screen. You can see most area of photo. Meaning of this photo would not be lost.<br>
- If your photo is vertical, `'contain'` is good for this case. Of course, you can see the black areas in left and right sides of your photo. But with `'cover'`, this photo would show only small part of image - like just close-up of someone's nose holes. What is this??

