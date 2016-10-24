var GoogleSpreadsheet = require('google-spreadsheet')
var async = require('async')

var doc = new GoogleSpreadsheet('1pu6OYYrLFwHdEc9o3DFPfdRX42iD66Z310LyMZ52j0s')
var sheet
var model

function setAuth(step) {
  var creds = require('./Personal hacks-0e20089bab35.json');
  doc.useServiceAccountAuth(creds, step);
}

function getSheet(name){
  return step => {
    doc.getInfo(function(err, info) {
      console.log('Loaded doc: '+info.title);
      sheet = info.worksheets[1];
      console.log('sheet: '+sheet.title+' '+sheet.rowCount+'x'+sheet.colCount);
      step();
    });
  }
}

function createModel(step) {
  sheet.getCells({
    'max-row': 3,
    'min-col': 2,
    'return-empty': true,
  }, function(err, cells) {
    var allCells = [[], [], []]
    cells.forEach(cell => allCells[cell.row - 1][cell.col] = cell)
    model = []
    // - iterate first row till END
    //   - if value
    //     - get value & type
    //   - if space
    //     - get 2nd row value & type
    //     - set in last value
    allCells[0].some(cell => {
      if (!cell) return
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
          children: child ? [{ name: child.value, type, col: cell.col }] : null,
        })
      } else {
        if (!model.length) return
        // Update last value
        (model[model.length - 1].children || []).push({ name: child.value, type, col: cell.col })
      }
    })
    console.log('MODEL ---\n', model)

    step();
  });
}

Array.prototype.and = Array.prototype.concat
const asyncArray = []
  .and(setAuth)
  .and(getSheet('2016'))
  .and(createModel)
  // .and(startServer)

async.series(asyncArray)
