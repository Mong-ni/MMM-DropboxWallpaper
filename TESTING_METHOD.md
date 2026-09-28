# Testing Method

This document describes how to install and update the `Testing` branch on a Linux or Raspberry Pi MagicMirror system.

## New installation

```bash
cd ~/MagicMirror/modules
git clone --branch Testing --single-branch https://github.com/Mong-ni/MMM-DropboxWallpaper.git
cd MMM-DropboxWallpaper
npm install
```

The install script creates `.env` from `example.env` only when `.env` is missing. An existing `.env` file is preserved.

## Update an existing installation

```bash
cd ~/MagicMirror/modules/MMM-DropboxWallpaper
git fetch origin
git switch Testing
git pull --ff-only origin Testing
npm install
```

Before updating, make sure any local changes have been saved. If `.env` is missing, `npm install` creates it from `example.env`; existing settings are not overwritten.
