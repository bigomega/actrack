$(function(){
  $('#workout .save-workout').click(function(){
    var data = { row: $('#main').attr('data-row') }
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

    $('.save-workout').addClass('disabled').text('Saving...')
    $.post('/api/workout/activity', data)
      .done(function(){
        window.location.reload()
      })
      .fail(function(err, res){
        $('.save-workout').removeClass('disabled').text('Save')
        window.alert('error', JSON.stringify(err), JSON.stringify(res.body))
      })
  })

  $('#balance .edit, #balance .note').click(function(){
    $('.model-container').addClass('open')
    var row = data[$(this).data('id')]
    var month = +(row[0].value).replace(/^.*\/(.*)\/.*$/, '$1') - 1
    var year = +(row[0].value).replace(/^.*\/.*\/(.*)$/, '$1')
    var day = +(row[0].value).replace(/^(.*)\/.*\/.*$/, '$1')
    $('#balance .model .date').text((new Date(day, month, year)).toDateString())
    $('#balance .model .spending').text(row[11].numericValue)
    $('#balance .model .category').val(row[13].value)
    $('#balance .model .comment').val(row[12].value)
    $('#balance .model .note').val(row[14].value)
  })

  $('#balance .model-container').click(function(e){
    $(e.target).hasClass('model-container') && $('.model-container').removeClass('open')
  })
  $('#balance .model .close').click(function(e){
    $('.model-container').removeClass('open')
  })
})
