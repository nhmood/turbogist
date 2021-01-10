module.exports = (payload) =>
`
<!DOCTYPE html>
<html lang="en">
<head>

  <meta charset="utf-8">
  <title>turbogist</title>
  <meta name="description" content="">
  <meta name="author" content="">

  <meta name="viewport" content="width=device-width, initial-scale=1">

  <link href="//fonts.googleapis.com/css?family=Raleway:400,300,600" rel="stylesheet" type="text/css">
  <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.8.1/css/all.css" integrity="sha384-50oBUHEmvpQ+1lW4y57PTFmhCaXp0ML5d60M1M7uH2+nqUivzIebhndOJK28anvf" crossorigin="anonymous">



  <link rel="stylesheet" href="/css/normalize.css">
  <link rel="stylesheet" href="/css/skeleton.css">
  <link rel="stylesheet" href="/css/custom.css">

  <link rel="icon" type="/image/png" href="/images/favicon.png">

</head>
<body>

  <div class="container">
    <div id="header" class="row">
      <div class="one-half column">
        <h3>turbo<strong>gist</strong></h3>
      </div>
    </div>


    <div id="main">
    </div> <!-- main -->

</body>
<script>
  localStorage.setItem("tgAuthInit", JSON.stringify(${JSON.stringify(payload)}));
  window.location.href = "/";
</script>
<script src="/js/turbogist.js"></script>
</html>
`
