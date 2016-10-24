var GoogleSpreadsheet = require('google-spreadsheet')
var async = require('async')
var express = require('express')
var moment = require('moment')
var app = express()

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
    model = []
    // - iterate first row till END
    //   - if value
    //     - get value & type
    //   - if space
    //     - get 2nd row value & type
    //     - set in last value
    allCells[0].some(cell => {
      if (!cell || cell.col < 2) { return }
      if (cell.value === '--END--')
        return true

      const child = allCells[1][cell.col]
      const type = (allCells[2][cell.col] || {}).value
      if (!type) return
      if (cell.value) {
        model.push({
          name: cell.value,
          type,
          col: cell.col,
          children: child.value ? [{ name: child.value, type, col: cell.col }] : null,
        })
      } else {
        if (!model.length) { return }
        // Update last value
        (model[model.length - 1].children || []).push({ name: child.value, type, col: cell.col })
      }
    })
    console.log('--- MODEL ---\n', model)

    step();
  });
}

function startServer(step) {
  app.set('view engine', 'pug');
  app.use(express.static('public'))
  app.get('/', (req, res) => res.render('index', { model }))
  app.get('/activity', getCellsOnReq)
  // app.post('/activity', updateCellsOnReq)
  app.listen(3000, '0.0.0.0', function() { console.log('app listening...') })
  step()
}

function getCellsOnReq(req, res) {
  const queryDate = req.query.date ? moment(req.query.date) : moment()
  if (queryDate.diff(startDate, 'd') < 1) {
    res.status(412)
    return res.json({ message: 'Date too early' })
  }
  // 2 extra rows + row starts with 1
  const row = queryDate.diff(startDate, 'd') + 2 + 1
  console.log(`[req] for ${queryDate.format('l')} ie., R${row}`)
  sheet.getCells({
    'min-row': row,
    'max-row': row,
    'min-col': 2,
    'return-empty': true,
  }, function(err, cells) {
    // console.log(cells.length)
    res.json(err || cells)
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
