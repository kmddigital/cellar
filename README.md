# Cellar
> A Lightweight Node.js CMS

![WIP](https://img.shields.io/badge/status-WIP-red.svg?style=flat) ![Version](https://img.shields.io/badge/version-0.0.5-blue.svg?style=flat) [![GitHub issues](https://img.shields.io/github/issues/kmddigital/cellar.svg?style=flat)](https://github.com/kmddigital/cellar/issues) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://raw.githubusercontent.com/kmddigital/cellar/master/LICENSE)  [![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat)](https://github.com/Flet/semistandard) [![Twitter](https://img.shields.io/twitter/url/https/github.com/kmddigital/cellar.svg?style=social)](https://twitter.com/intent/tweet?text=Cellar%3A%20A%20Lightweight%20Node.js%20CMS%20https%3A%2F%2Fgithub.com%2Fkmddigital%2Fcellar)

Cellar is a CMS built with [Node.js](https://nodejs.org/en/) and [Express](https://expressjs.com/) made for both developers and users. It's meant to be both lightweight and heavily customizable.

Cellar was made by [KMD Digital](http://kmddigital.com) primarily for use on our own projects but we've opened it up to the community as well. Cellar is open-sourced under the [MIT](https://github.com/kmddigital/cellar/blob/master/LICENSE) license.

## Roadmap
Cellar is a **work in progress** and at this time is **NOT** ready for use. Below is a list of things we still need to work on.

###### TODO:
- [ ] Theming System
  - [ ] Default theme(s)
- [ ] Plugin System
- [ ] Admin Panel
  - [ ] Design
  - [ ] Settings
- [x] Database Integration (MongoDB)
- [x] Authentication
  - [ ] User roles
- [ ] Actual CMS (Pages, Types, ect.)
  - [ ] Pages
  - [ ] Custom Types
- [x] SMTP Support
- [ ] WYSIWYG Editor
- [x] Setup Utility

###### Optional/Future Releases:
- [ ] Restful API
- [ ] Additional Mailer Methods (SendGrid, Mailgun, ect.)
- [ ] Automatic Updater

## Getting Started
*Requires [Node.js](https://nodejs.org/en/) and [MongoDB](https://www.mongodb.com/download-center).*

#### Production
```bash
# download files
git clone https://github.com/kmddigital/cellar.git
# install (production) dependencies
npm install --production
# run setup script
npm run setup
```

#### Development
```bash
# download files
git clone https://github.com/kmddigital/cellar.git
# install (all) dependencies
npm install
# run tests (make changes first)
npm run test
# automatically fix style errors (if needed)
npm run fix
# start server
npm run dev
```
