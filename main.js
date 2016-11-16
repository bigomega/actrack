var GoogleSpreadsheet = require('google-spreadsheet')
var async = require('async')
var express = require('express')
var moment = require('moment')
var app = express()
var bodyParser = require('body-parser')
var basicAuth = require('basic-auth')

var workout = {
  doc: new GoogleSpreadsheet('1pu6OYYrLFwHdEc9o3DFPfdRX42iD66Z310LyMZ52j0s'),
  // yearSheet, model, startDate
}
var balance = {
  doc: new GoogleSpreadsheet('1rSFdj4a8fv2aA0FqNES20Ix7tY_VJXI1vNuWGJuNuY0'),
  // dataSheet, categoriesSheet
}

function setAuth(step) {
  var creds = require('./Personal hacks-0e20089bab35.json');
  async.series([
    s => workout.doc.useServiceAccountAuth(creds, s)
    , s => balance.doc.useServiceAccountAuth(creds, s)
  ] , err => step(err))
}

function getSheets(step) {
  console.log('Authenticating...')
  async.series([
    s => workout.doc.getInfo(function(err, info) {
      workout._sheets = info
      workout.yearSheet = info.worksheets.filter(s => s.title == '2016')[0];
      if (!workout.yearSheet) { return step('No Sheet - 2016', err); }
      console.log(`Loaded doc: ${info.title}, sheet: ${workout.yearSheet.title}`);
      s(err);
    })
    , s => balance.doc.getInfo(function(err, info) {
      balance._sheets = info
      balance.dataSheet = info.worksheets.filter(s => s.title == 'Data')[0];
      balance.categoriesSheet = info.worksheets.filter(s => s.title == 'Categories')[0];
      if (!balance.dataSheet || !balance.categoriesSheet) { return step('No Sheet - Data/Categories', err); }
      console.log(`Loaded doc: ${info.title}, sheet: Data, sheet: Categories`);
      s(err);
    })
  ] , err => step(err))
}

balance.getCategories = function(cb) {
  console.log('--- Balance ---')
  balance.categoriesSheet.getCells({
    'min-row': 11,
    'max-row': 11,
    'min-col': 3,
    'max-col': 13,
    'return-empty': true,
  }, function(err, cells) {
    if (err) { return cb(err) }
    balance.categories = cells.map(c => c.value)
    console.log(' - Categories: ', balance.categories.join(', '))
    cb(null)
  })
}

workout.createModel = function(cb) {
  console.log('--- Workout ---')
  workout.yearSheet.getCells({
    'max-row': 3,
    'return-empty': true,
  }, function(err, cells) {
    if (err) { return cb(err) }
    var allCells = [[], [], []]
    // row starts from 0 but cell from 1. Weird, I know
    cells.forEach(cell => allCells[cell.row - 1][cell.col] = cell)
    workout.startDate = moment(allCells[2][1].value, 'MMM D, YYYY')
    console.log(' - Start Date:', workout.startDate.format('l'))
    const model = { values: [] }
    // - iterate first row till "--END--"
    //   - if value
    //     - get value & type & child
    //   - if space
    //     - get 2nd row value & type
    //     - set in last value
    allCells[0].some(cell => {
      if (!cell || cell.col < 2) { return }
      if (cell.value === '--END--') {
        model.max = cell.col
        return true
      }

      const child = allCells[1][cell.col]
      const type = (allCells[2][cell.col] || {}).value
      if (!type) return
      if (cell.value) {
        model.values.push({
          name: cell.value,
          type,
          col: cell.col,
          children: child.value ? [{ name: child.value, type, col: cell.col }] : null,
        })
      } else {
        if (!model.values.length) { return }
        // Update last value
        (model.values[model.values.length - 1].children || []).push({ name: child.value, type, col: cell.col })
      }
    })
    console.log(' - MODEL\n', model)
    workout.model = model

    cb(null);
  });
}

var auth = function (req, res, next) {
  const user = basicAuth(req)
  if (user && user.name === 'foo' && user.pass === 'crowbar') {
    return next()
  }

  res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
  return res.sendStatus(401)
}

function startServer(step) {
  app.set('view engine', 'pug');
  app.use(express.static('public'))
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.get('/', (req, res) => res.redirect('/workout'))
  app.get('/workout(/past/:count)?', auth, (req, res) => {
    const count = +req.params.count || 0
    const date = moment().subtract(count, 'd')
    const isAndroid = req.headers['user-agent'].match(/Android/) // Will remove after 🏋 emoji is implemented
    workout.getData(date, (e, cells) => e ? res.send(e) : res.render('index', { model: workout.model, cells, date, count, isAndroid }))
  })
  app.get('/api/workout/activity/:date?', auth, (req, res) =>
    workout.getData(req.params.date, (err, cells) => err ? res.send(err) : res.json(cells))
  )
  app.get('/api/workout/model', auth, (req, res) => res.json(workout.model))
  app.put('/api/workout/model', (req, res) => // Re-Model
    workout.createModel(err => err ? res.send(err) : res.json({ message: 'ok' }))
  )
  app.post('/api/workout/activity', workout.updateCells)

  app.get('/balance(/past/:count)?', auth, (req, res) => {
    const count = +req.params.count || 0
    const isAndroid = req.headers['user-agent'].match(/Android/) // Temp fix
    balance.getRows(count, (e, data) =>
      e ? res.send(e) : res.render('balance', Object.assign({ categories: balance.categories, moment, isAndroid }, data))
    )
  })
  app.get('/api/balance(/past/:count)?', auth, (req, res) => {
    const count = +req.params.count || 0
    balance.getRows(count, (e, cells) => res.json({ e, cells, categories: balance.categories }))
  })
  app.post('/api/balance', balance.updateCells)

  app.listen(3000, '0.0.0.0', function() { console.log('--- App ---\n - Listening... 0.0.0.0:3000') })
  step()
}

workout.getData = function(date, cb) {
  const queryDate = date ? moment(date) : moment()
  if (queryDate.diff(workout.startDate, 'd') < 1) {
    return cb({ message: 'Date too early' })
  }
  // 2 extra rows + row starts with 1
  const row = queryDate.diff(workout.startDate, 'd') + 2 + 1
  console.log(`[GET] Workout: ${queryDate.format('l')} - R${row}`)
  workout.yearSheet.getCells({
    'min-row': row,
    'max-row': row,
    'min-col': 2,
    'max-col': workout.model.max + 2,
    'return-empty': true,
  }, function(err, cells) {
    const cellsObj = !err && cells && cells.reduce((mem, c) => (mem[c.col] = c, mem), { row })
    typeof cb === 'function' && cb(err, cellsObj)
  })
}

workout.updateCells = function(req, res) {
  const data = req.body
  if (!data.row) {
    return res.status(400) && res.send({ message: 'Row not found' })
  }
  workout.yearSheet.getCells({
    'min-row': data.row,
    'max-row': data.row,
    'max-col': workout.model.max,
    'return-empty': true,
  }, function(err, cells) {
    if (err) { res.status(400); return res.send(err) }
    const findCell = (col) => cells.filter(cell => cell.col == col)[0]
    workout.model.values.forEach(act => (act.children || [act]).forEach(a => {
      if (data[a.col] !== undefined && findCell(a.col))
        findCell(a.col).value = data[a.col]
    }))
    const date = moment((findCell(1) || {}).value, 'MMM D, YYYY').format('l')
    console.log(`[POST] Workout: ${date} - R${data.row}`)
    workout.yearSheet.bulkUpdateCells(cells, (error) => {
      console.log('  => values: ', JSON.stringify(data))
      error ? res.status(400) && res.send(error) : res.json({ message: 'ok' })
    })
  })
}

balance.getRows = function(pushBack, cb) {
  let sbiDate, stanCharDate
  const PAST_DAYS = 30
  async.waterfall([
    s => balance.dataSheet.getCells({
        'max-row': 4,
        'min-col': 7,
        'max-col': 7,
      }, (err, cells) => {
        if (err) { return s(err) }
        const c = cells.slice().sort((x,y) => x.row - y.row)
        stanCharDate = moment(c[2].value, 'D-MMM')
        sbiDate = moment(c[3].value, 'D-MMM')
        s(null, +c[0].value)
      })
    , (next, s) => {
      const today = next - 1 - pushBack
      const past = today > PAST_DAYS + 2 ? (today - PAST_DAYS) : 2
      console.log(`[GET] Balance: R${past} - R${today}`)
      if (today < 3) { return s('Can\'t go any further...', {}) }
      s(null, today, past)
    }
    , (today, past, s) => balance.dataSheet.getCells({
        'min-row': past,
        'max-row': today,
        'return-empty': true,
      }, (err, cells) => {
        if (err) { return s(err) }
        let rows = cells.reduce((mem, c) => {
          const i = c.row - past
          mem[i] = mem[i] ? (mem[i].push(c), mem[i]) : [c]
          return mem
        }, [])
        rows = rows.map(r => r.sort((x,y) => x.col - y.col))
        s(null, { rows, sbiDate, stanCharDate })
      })
  ], cb)
}

balance.updateCells = function(req, res) {
  const UPDATE_ALLOWED_CELLS = { 13: true, 14: true, 15: true }
  const data = req.body
  if (!data.row) {
    return res.status(400) && res.send({ message: 'Row not found' })
  }
  balance.dataSheet.getCells({
    'min-row': data.row,
    'max-row': data.row,
    'min-col': 13,
    'return-empty': true,
  }, function(err, cells) {
    if (err) { res.status(400); return res.send(err) }
    console.log(`[POST] Balance: R${data.row} - ${moment(cells[0].value, 'M/D/YY').format('l')}`)
    cells.forEach(c => {
      if (c.col in UPDATE_ALLOWED_CELLS && req.body[c.col] !== undefined)
        c.value = req.body[c.col]
    })
    balance.dataSheet.bulkUpdateCells(cells, (error) => {
      console.log('  => values: ', JSON.stringify(data))
      error ? res.status(400) && res.send(error) : res.json({ message: 'ok' })
    })
  })
}

function debug(step) {
  step()
}

Array.prototype.and = Array.prototype.concat

const asyncArray = []
  .and(setAuth)
  .and(getSheets)
  .and(workout.createModel)
  .and(balance.getCategories)
  // .and(debug)
  .and(startServer)

async.series(asyncArray, x => x && console.log('---- ERROR :', x))
