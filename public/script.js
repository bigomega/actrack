$(function(){
  $('#workout .save').click(function(){
    var data = { row: $('#workout').attr('data-row') }
    $('[data-col]').each(function(i, el){
      var col = $(el).attr('data-col')
      var value
      if ($(el).attr('data-type') == 'bool') {
        value = $('[name=bool-'+col+']:checked').val()
      } else {
        value = el.value
      }
      data[col] = value
    })

    $('.save').addClass('disabled').text('Saving...')
    $.post('/api/workout/activity', data)
      .done(function(){
        window.location.reload()
      })
      .fail(function(err, res){
        $('.save').removeClass('disabled').text('Save')
        window.alert('error', JSON.stringify(err), JSON.stringify(res.body))
      })
  })

  $('#balance .calendar select').change(function(e){
    var that = this
    $('#balance .calendar select').attr('disabled', true)
    var data = {
      row: rows[$(this).data('id')][0].row,
      14: $(this).val(),
    }
    $.post('/api/balance', data)
      .done(function(){
        var newClasses = $(that).parent().attr('class').replace(/(category-type-)[a-z]*/, '$1' + $(that).val().toLowerCase())
        $(that).parent().attr('class', newClasses)
      })
      .fail(function(err, res){
        window.alert('error', JSON.stringify(err), JSON.stringify(res.body))
      })
      .always(function(){
        $('#balance .calendar select').attr('disabled', false)
      })
  })

  var modelSaving

  $('#balance .calendar .edit, #balance .calendar .note').click(function(){
    $('.model-container').addClass('open')
    var row = rows[$(this).data('id')]
    var month = +(row[0].value.replace(/^(.*)\/.*\/.*$/, '$1') - 1)
    var day = +(row[0].value.replace(/^.*\/(.*)\/.*$/, '$1'))
    var year = +(row[0].value.replace(/^.*\/.*\/(.*)$/, '20$1'))
    $('#balance .model .row').val(row[0].row)
    $('#balance .model .date').text((new Date(year, month, day)).toDateString())
    $('#balance .model .spending').text(row[11].numericValue.toLocaleString())
    $('#balance .model .category').val(row[13].value)
    $('#balance .model .comment').val(row[12].value)
    $('#balance .model .note').val(row[14].value)
  })

  $('#balance .model .save').click(function(){
    var that = this
    var data = {
      row: $('#balance .model .row').val(),
      13: $('#balance .model .comment').val(),
      14: $('#balance .model .category').val(),
      15: $('#balance .model .note').val(),
    }
    $(that).addClass('disabled').text('Saving...')
    modelSaving = true
    $.post('/api/balance', data)
      .done(function(){
        window.location.reload()
      })
      .fail(function(err, res){
        $(that).removeClass('disabled').text('Save')
        window.alert('error', JSON.stringify(err), JSON.stringify(res.body))
      })
  })

  $('#balance .model-container').click(function(e){
    if (!modelSaving && $(e.target).hasClass('model-container'))
      $('.model-container').removeClass('open')
  })
  $('#balance .model .close').click(function(e){
    !modelSaving && $('.model-container').removeClass('open')
  })
})
