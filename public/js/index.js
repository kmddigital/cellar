var imageIndex = 1;

$(window).on("load", function()
{
  setTimeout(changeImage, 60000);
})

function changeImage()
{
  $('.mh' + imageIndex).css("display", "none");
  imageIndex = imageIndex + 1;
  if (imageIndex > 4)
    imageIndex = 1;
  $('.mh' + imageIndex).css("display", "block");
  console.log('Change Image', changeImage);
  setTimeout(changeImage, 60000);
}
