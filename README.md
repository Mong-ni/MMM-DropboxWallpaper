# MMM-DropboxWallpaper
Module for `MagicMirror` which can show images from `Dropbox`

## v2.0.0 Notice
This module is upgraded to v2.0.0. (Since Aug 2nd, 2018).
You can find the previous version(v1.0.0) in github branch [`v1.0.0`](https://github.com/eouia/MMM-DropboxWallpaper/tree/v1.0.0)
For updating to v2.0.0. You should;
```shell
cd ~/MagicMirror/modules/MMM-DropboxWallpaper
git pull
npm install
```
And configuration is changed. You should modify your `config.js`

### Improvement in v2
- Whole new created (for using Latest API(Dropbox API ^4.0) and better performance)
- Profile deprecated (I think nobody use this feature)
- scanInterval deprecated (After each cycle, it will rescan automatically)
- Auto image rotation by EXIF orientation value. (But wrong orientation could give unexpected distortion of image when be rotated.)
- auto scan for subdirectories.
- filename filter enabled. (You can find target files with search filter like `".jpg"` or `"DSC"` or `"wedding_"`. )
- jpg, png, gif supported. But only `jpg` can abstract EXIF info.

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
    refreshInterval: 1000*60,
    search: [".jpg", ".png", ".gif"], // Or you can find target files like "PARTIAL FILENAME". (wildcard or regexp not supported)
    directory: "/", // root of directories of Dropbox to be scanned.
    sort: "random", //"time09", "time90", "nameAZ", "nameZA", "random"
    tokenLocationIQ : "YOUR_LOCATIONIQ_TOKEN", // See http://locationiq.org/#register
    dropboxAccessToken: "YOUR_DROPBOX_TOKEN",
    width: "100%", // 'px' or '%' or valid value for CSS dimensions units.
    height: "100%",
    mode: "cover", // 'cover', 'contain', 'hybrid' or any other values for CSS `background-size`
    dateTimeFormat: "HH:mm MMM Do, YYYY", // See. moment.js .format()
  }
},

```

#### about `.mode`
You can get information about `cover` and `contain` in here : https://css-tricks.com/almanac/properties/b/background-size/#article-header-id-0
Both have some demerits.
- `cover` tells the browser to make sure the image **always covers the entire container**, even if it has to stretch the image or cut a little bit off one of the edges.
- `contain`, on the other hand, says to **always show the whole image**, even if that leaves a little space to the sides or bottom.
- `hybrid` : By the ratio of W/H of photo and comparing with those of screen, this option could change mode automatically between 'cover' and 'contain'.

Suppose your `MM` has a horizontal screen.
- If your photo is also horizontal, `'cover'` is good option. This horizontal photo with `cover` could be shown pretty on entire screen. You can see most area of photo. Meaning of this photo would not be lost.<br>
- If your photo is vertical, `'contain'` is good for this case. Of course, you can see the black areas in left and right sides of your photo. But with `'cover'`, this photo would show only small part of image - like just close-up of someone's nose holes. What is this??

### This is not a bug, but ...
Sometimes your photos could have abnormal orientation. You might not recognize that because most of modern common photo viewers can auto-rotate it cleverly. But HTML Renderer of Chromium/Electron is not so smart. So it should be rotated to right orientation by manual. (Some CSS specification about it is suggested but experimental currently.)
My module rotate those kinds of images to right orientation, but there is one problem. Result of `transform:rotate()` can make image rotation, but also make extra empty space in image area. It could be ugly using `mode:cover` or `mode:contain`.
I also tried to rotate a photo file itself downloaded, but it took a very long processing time horribly in RaspberryPI. It is too burden to RPI. So, I forgive that kind of approach.

The better solution is, re-save those kinds of photos with right orientation.(Of course, do it in your powerful PC). I think most modern photo editor could do that by export menu.
Or you can use this;
- http://annystudio.com/software/jpeglosslessrotator/ (For Windows)
