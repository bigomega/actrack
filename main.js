var GoogleSpreadsheet = require('google-spreadsheet')
var async = require('async')
var express = require('express')
var moment = require('moment')
var app = express()
var bodyParser = require('body-parser')
var basicAuth = require('basic-auth')

var doc = new GoogleSpreadsheet('1pu6OYYrLFwHdEc9o3DFPfdRX42iD66Z310LyMZ52j0s')
var sheet
var model
var startDate

function setAuth(step) {
  var creds = require('./Personal hacks-0e20089bab35.json');
  doc.useServiceAccountAuth(creds, step);
}

function getSheet(name){
  return step => {
    console.log('Authenticating...')
    doc.getInfo(function(err, info) {
      sheet = info.worksheets[1];
      console.log(`Loaded doc: ${info.title}, sheet: ${sheet.title}`);
      step();
    });
  }
}

function createModel(step) {
  sheet.getCells({
    'max-row': 3,
    'return-empty': true,
  }, function(err, cells) {
    var allCells = [[], [], []]
    // row starts from 0 but cell from 1. Weird, I know
    cells.forEach(cell => allCells[cell.row - 1][cell.col] = cell)
    startDate = moment(allCells[2][1].value, 'MMM D, YYYY')
    console.log('--- Start Date -', startDate.format('l'))
    model = { values: [] }
    // - iterate first row till "--END--"
    //   - if value
    //     - get value & type
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
    console.log('--- MODEL ---\n', model)

    step();
  });
}

var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
    return res.sendStatus(401)
  }

  var user = basicAuth(req)

  if (!user || !user.name || !user.pass) {
    return unauthorized(res)
  }

  if (user.name === 'foo' && user.pass === 'crowbar') {
    return next()
  } else {
    return unauthorized(res)
  }
}

function startServer(step) {
  app.set('view engine', 'pug');
  app.use(express.static('public'))
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.get('(/past/:count)?', auth, (req, res) => {
    const date = moment().subtract(+req.params.count || 0, 'd')
    getCellsForDate(date, (e, cells) => e ? res.send(e) : res.render('index', { model, cells, date }))
  })
  app.get('/activity/:date', auth, (req, res) =>
    getCellsForDate(req.params.date, (err, cells) => err ? res.send(err) : res.json(cells))
  )
  app.post('/activity', updateCellsOnReq)
  app.listen(3000, '0.0.0.0', function() { console.log('app listening...') })
  step()
}

function getCellsForDate(date, cb) {
  const queryDate = date ? moment(date) : moment()
  if (queryDate.diff(startDate, 'd') < 1) {
    return cb({ message: 'Date too early' })
  }
  // 2 extra rows + row starts with 1
  const row = queryDate.diff(startDate, 'd') + 2 + 1
  console.log(`[GET] ${queryDate.format('l')} - R${row}`)
  sheet.getCells({
    'min-row': row,
    'max-row': row,
    'min-col': 2,
    'max-col': model.max,
    'return-empty': true,
  }, function(err, cells) {
    const less_cells = cells && cells.reduce((mem, c) => (mem[c.col] = c, mem), { row })
    typeof cb === 'function' && cb(err, less_cells)
  })
}

function updateCellsOnReq(req, res) {
  const data = req.body
  if (!data.row) {
    return res.status(400) && res.send({ message: 'Row not found' })
  }
  sheet.getCells({
    'min-row': data.row,
    'max-row': data.row,
    'max-col': model.max,
    'return-empty': true,
  }, function(err, cells) {
    const findCell = (col) => cells.filter(cell => cell.col == col)[0]
    model.values.forEach(act => (act.children || [act]).forEach(a => {
      if (data[a.col] !== undefined && findCell(a.col))
        findCell(a.col).value = data[a.col]
    }))
    const date = moment((findCell(1) || {}).value, 'MMM D, YYYY').format('l')
    console.log(`[POST] ${date} - R${data.row}`)
    sheet.bulkUpdateCells(cells, (err) => {
      console.log('  => values: ', data)
      err ? res.status(400) && res.send(err) : res.json({ message: 'ok' })
    })
  })
}

function debug(step) {
  step()
}

Array.prototype.and = Array.prototype.concat
const asyncArray = []
  .and(setAuth)
  .and(getSheet('2016'))
  .and(createModel)
  // .and(debug)
  .and(startServer)

async.series(asyncArray)
