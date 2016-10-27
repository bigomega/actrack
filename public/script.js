$(function(){
  $('.save').click(function(){
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

    $.post('/api/activity', data)
      .done(function(){
        window.location.reload()
      })
      .fail(function(err, res){
        window.alert('error', JSON.stringify(err), JSON.stringify(res.body))
      })
  })
})
